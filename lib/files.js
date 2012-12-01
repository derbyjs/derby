// `files` module handle reading of an application files on the server. It is
// used only by `View.server` and `refresh.server` modules.
//
// `View.server` loads files to render them to response; and `refresh.server`
// watches for changes in files to push changes to the clients.
//
// ## Types of files
//
// *   Template file
//
//     Template file are also HTML, but each template is wrapped in a tag that
//     names the template. This name must end in a colon to differentiate it
//     from a normal HTML tag. These tags need not be closed. For example:
//
//         <import: src="otherFile">
//
//         <Title:>
//           Silly example
//
//         <Body:>
//           <h1>Howdy!</h1>
//
// *   Style file
//
//     Can be a plain CSS file or a file which needs LESS or Stylus CSS
//     preprocessor. For a list of supported style compilers, see
//     `styleCompilers` variable defined below.
//
// *   JavaScript files
//
// *   Library files
//
// ## Dependencies explained
//
// * `crypto` module is used to create a MD5 hash of a generated file
// * `chokidar` module is used to wathc for changes in files
// * `stylus` module is used to compile `*.styl` files to CSS
// * `nib` is used by `stylus`
// * `less` module is used to compile `*.less` files to CSS
// * `html-util` is used to parse and minify HTML

var pathUtil = require('path')
  , fs = require('fs')
  , dirname = pathUtil.dirname
  , basename = pathUtil.basename
  , join = pathUtil.join
  , exists = fs.exists || pathUtil.exists
  , relative = pathUtil.relative
  , resolve = pathUtil.resolve
  , crypto = require('crypto')
  , chokidar = require('chokidar')
  , stylus = require('stylus')
  , nib = require('nib')
  , less = require('less')
  , racer = require('racer')
  , Promise = racer.util.Promise
  , hasKeys = racer.util.hasKeys
  , finishAfter = racer.util.async.finishAfter
  , asyncForEach = racer.util.async.forEach
  , htmlUtil = require('html-util')
  , parseHtml = htmlUtil.parse
  , minifyHtml = htmlUtil.minify
  , styleCompilers = {
      stylus: stylusCompiler
    , less: lessCompiler
    }
  , isWindows = process.platform === 'win32'

exports.css = css;
exports.templates = templates;
exports.js = js;
exports.library = library;
exports.parseName = parseName;
exports.hashFile = hashFile;
exports.writeJs = writeJs;
exports.watch = watch;

// ## Loading style file from the `/styles` directory
function css(root, clientName, compress, callback) {
  // TODO: Set default configuration options in a single place
  var styles = require('./derby').settings.styles || ['less', 'stylus']
    , compiled = []
    , finish;

  root += '/styles';

  if (!Array.isArray(styles)) styles = [styles];

  finish = finishAfter(styles.length, function(err) {
    callback(err, compiled.join(''));
  });

  styles.forEach(function(style, i) {
    var compiler = styleCompilers[style];
    if (!compiler) finish(new Error('Unable to find compiler for: ' + style));

    compiler(root, clientName, compress, function(err, value) {
      compiled[i] = value || '';
      finish(err);
    });
  });
}

function stylusCompiler(root, clientName, compress, callback) {
  findPath(root, clientName, '.styl', function(path) {
    if (!path) return callback('');
    fs.readFile(path, 'utf8', function(err, styl) {
      if (err) return callback(err);
      stylus(styl)
        .use(nib())
        .set('filename', path)
        .set('compress', compress)
        .render(callback);
    });
  });
}

function lessCompiler(root, clientName, compress, callback) {
  var dir = clientName.charAt(0) === '/' ? dirname(clientName) : root;
  findPath(root, clientName, '.less', function(path) {
    if (!path) return callback('');

    fs.readFile(path, 'utf8', function(err, lessFile) {
      if (err) return callback(err);
      var parser = new less.Parser({
        paths: [dirname(path)]
      , filename: path
      });
      parser.parse(lessFile, function(err, tree) {
        var compiled;
        if (err) return callback(err);
        try {
          compiled = tree.toCSS({compress: compress});
        } catch (err) {
          return callback(err);
        }
        callback(null, compiled);
      });
    });
  });
}

// ## Loading template file from the `/views` directory
function templates(root, clientName, callback) {
  loadTemplates(root + '/views', clientName, callback);
}

// ## TODO: Loading JavaScript file
//
// Exposed. Not used by the `files` module internally.
/**
 *
 * Allowed calling signatures:
 *
 * * js(String parentFilename, Object options, Function callback)
 * * js(String parentFilename, Function callback)
 *
 * @param  {String}   parentFilename [description]
 * @param  {Object}   options        Optional.
 * @param  {Function} callback       [description]
 * @return {[type]}                  [description]
 */
function js(parentFilename, options, callback) {
  var finish, inline, inlineFile, js;

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // Needed for tests
  if (!parentFilename) return callback();

  // TODO: Move this to Tracks:
  // Express will try to include mime or connect, which won't work in the
  // browser. It doesn't actually need this for routing, so just ignore it
  options.ignore = ['connect', 'mime'];
  options.entry = parentFilename;

  inlineFile = join(dirname(parentFilename), 'inline.js');
  finish = finishAfter(2, function(err) {
    callback(err, js, inline);
  });
  racer.js(options, function(err, value) {
    js = value;
    finish(err);
  });
  fs.readFile(inlineFile, 'utf8', function(err, value) {
    inline = value;
    // Ignore file not found error
    if (err && err.code === 'ENOENT') err = null;
    finish(err);
  });
}

// ## Loading component library
function library(root, callback) {
  var components = {};

  fs.readdir(root, function(err, files) {
    if (err) return callback(err);
    asyncForEach(files, libraryFile, function(err) {
      if (err) return callback(err);
      callback(null, components);
    });
  });

  function libraryFile(file, callback) {
    var path = root + '/' + file
    fs.stat(path, function(err, stats) {
      if (err) return callback(err);

      if (stats.isDirectory()) {
        return addComponent(root, file, callback);
      }
      if (extensions['html'].test(file)) {
        file = file.replace(extensions['html'], '');
        return addComponent(root, file, callback);
      }

      callback();
    });
  }

  function addComponent(root, name, callback) {
    loadTemplates(root, name, function(err, templates, instances) {
      components[name] = {
        templates: templates
      , instances: instances
      };
      callback(err);
    });
  }
}

// `unixRelative` function is not exposed. Called only from `parseTemplateFile`
// function.
function unixRelative(from, to) {
  var path = relative(from, to);
  return isWindows ? path.replace(/\\/g, '/') : path;
}

// ## Parse application filename
//
// Not used internally by `files` module. This method is used only from
// `View.server` and `refresh.server` modules.
/**
 * If `parentFilename` is set to `/path/lib/app/index.js`, for example,
 * returned object will be `{ root: '/path', clietnName: 'app' }`.
 *
 * @param  {String} parentFilename [description]
 * @param  {Object} options        [description]
 * @return {[type]}                [description]
 */
function parseName(parentFilename, options) {
  var parentDir = dirname(parentFilename)
    , root = parentDir
    , base = basename(parentFilename).replace(/\.(?:js|coffee)$/, '');
  if (base === 'index') {
    base = basename(parentDir);
    root = dirname(dirname(parentDir));
  } else if (basename(parentDir) === 'lib') {
    root = dirname(parentDir);
  }
  return {
    root: root
  , clientName: options.name || base
  };
}

// Exposed. Used by `watch` and `writeJs` functions internally.
function hashFile(file) {
  var hash = crypto.createHash('md5').update(file).digest('base64');
  // Base64 uses characters reserved in URLs and adds extra padding charcters.
  // Replace "/" and "+" with the unreserved "-" and "_" and remove "=" padding
  return hash.replace(/[\/\+=]/g, function(match) {
    switch (match) {
      case '/': return '-';
      case '+': return '_';
      case '=': return '';
    }
  });
}

// ## Writing generated JavaScript file to the file system
//
// Exposed as a public API function. Used only by `View.prototype._load` method
// from `View.server` module. Not used by `files` module internally.
/**
 * Write generated JavaScript file to be used by client
 *
 * @param  {String}   root     [description]
 * @param  {String}   js       [description]
 * @param  {Object}   options  [description]
 * @param  {Function} callback Called asynchronously as a
 *                             `callback(err, jsFile, hash)` when the JS file
 *                             is written to the file system
 * @return {undefined}
 */
function writeJs(root, js, options, callback) {
  var staticRoot = options.staticRoot || join(root, 'public')
    , staticMount = options.staticMount
    , staticDir = options.staticDir || '/gen'
    , staticPath = join(staticRoot, staticDir)
    , hash = hashFile(js)
    , filename = hash + '.js'
    , jsFile = (staticMount || '') + staticDir + '/' + filename
    , filePath = join(staticPath, filename);

  function finish() {
    fs.writeFile(filePath, js, function(err) {
      callback(err, jsFile, hash);
    });
  }
  exists(staticPath, function(value) {
    if (value) return finish();

    exists(staticRoot, function(value) {
      if (value) {
        fs.mkdir(staticPath, '0777', function(err) {
          finish();
        })
        return;
      }
      fs.mkdir(staticRoot, '0777', function(err) {
        fs.mkdir(staticPath, '0777', function(err) {
          finish();
        });
      });
    });
  });
}

// ## Watching for files changing
//
// Exposed. Not used by the `files` module internally.
function watch(dir, type, onChange) {
  var extension = extensions[type]
    , hashes = {}
    , watcher = chokidar.watch([])

  watcher
    .on('add', checkModified)
    .on('change', checkModified)
    .on('unlink', checkModified)
    .on('error', function(err) {
      console.error('Watch error\n', err);
    })

  files(dir, extension).forEach(function(path) {
    fs.readFile(path, 'utf8', function(err, file) {
      if (err) return console.error('Watch error\n', err);
      hashes[path] = hashFile(file);
      watcher.add(path);
    });
  });

  function checkModified(path) {
    fs.readFile(path, 'utf8', function(err, file) {
      if (err) return console.error('Watch error\n', err);
      var hash = hashFile(file);
      if (hash === hashes[path]) return;
      hashes[path] = hash;
      onChange(path);
    })
  }
}

function absolutePath(path) {
  return path === resolve('/', path);
}

// ## Find path to a file placed under the node.js modules placement scheme
//
// Not exposed. Used only by `stylusCompiler`, `lessCompiler` and `forTemplate`
// functions. Meaning that only style and template files will be searched by
// the rules of the node.js modules placement scheme.
//
/**
 * Find path to a file referenced by `root` and `name` and having `extension`
 *
 * This file can be placed at `root/name.extension` or under a
 * `root/name/index.extension` paths.
 *
 * For example call to `findPath('views', 'app', '.html')` can result in
 * `views/app.html`, `views/app/index.html` or `null` depending on a file
 * placement. If both files exists, the first one will be chosen.
 *
 * When done `callback` is called with exactly one parameter set to found `path`
 * or to a `null` if referenced file does not exists.
 *
 * @param  {String}   root      Used only when `name` isn't an absolute path
 * @param  {String}   name      Absolute path or a name of a file (without an
 *                              extension in both cases)
 * @param  {String}   extension File extension starting from a `.`, e.g. `.html`
 * @param  {Function} callback  Called asynchronously as `callback(path)`
 * @return {undefined}          Actual code returns result of a `callback`
 *                              calling if file exists at a first place.
 */
function findPath(root, name, extension, callback) {
  if (!absolutePath(name)) {
    name = join(root, name);
  }
  var path = name + extension;
  exists(path, function(value) {
    if (value) return callback(path);
    path = join(name, 'index' + extension);
    exists(path, function(value) {
      callback(value ? path : null);
    });
  });
}

// ## Load templates from a template file (also loading imported template files)
//
// Not exposed. Called only from `templates` and `library` functions.

/**
 * Load templates found inside `root` directory under `fileName` name
 *
 * @param  {[type]}   root     [description]
 * @param  {[type]}   fileName [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function loadTemplates(root, fileName, callback) {
  var count = 0
    , calls = {incr: incr, finish: finish};
  function incr() {
    count++;
  }
  function finish(err, templates, instances) {
    if (err) {
      calls.finish = function() {};
      return callback(err);
    }
    if (--count) return;
    if (hasKeys(instances)) {
      callback(null, templates, instances);
    } else {
      callback();
    }
  }
  forTemplate(root, fileName, 'import', calls);
}

// `forTemplate` function is not exposed. It is called only by `loadTemplates`
// and from `parseTemplateFile` when `<import: src="fileName">` is encountered.
//
// In first case it is called with only first four parameters, as
// `forTemplate(root, fileName, get, calls)`
//
// * `root` is a string, set to `/project-root/views`.
// * `fileName` is a string set to `app`

/**
 * Lookup for `fileName` template under `root`, read it, parse it and callback
 * `calls.finish` routine when parsed.
 *
 * It essentially calls increment function and executes `findPath()`, when path
 * is found it calls `parseTemplateFile()` on it.
 *
 * ## Callbacks
 *
 * Callbacks are given to this function using the `calls` parameter.
 *
 * *   `incr()`
 *
 *     Called without parameters each time this function start reading a
 *     template file from a file system, i.e. one time for main template file
 *     and each time for <import: src="file">
 *
 * *   `finish(err, templates, instances)`
 *
 *     Called
 *
 * @param  {String} root      Directory under which to lookup `fileName`
 * @param  {String} fileName  Name of a template file to load without extension
 * @param  {String|Array} get 'import' string or array
 * @param  {Object} calls     Should have `incr` and `finish` methods
 * @param  {Object} files     Optional. Map using absolute `path` to a file as
 *                            a key and file's content promise as a value.
 * @param  {Object} templates Optional.
 * @param  {Object} instances Optional.
 * @param  {[type]} alias     [description]
 * @param  {String} currentNs Optional.
 * @return {undefined} Function resuls are returned via callbacks from `calls`
 */
function forTemplate(root, fileName, get, calls, files, templates, instances, alias, currentNs) {
  if (currentNs == null) currentNs = '';
  calls.incr();
  findPath(root, fileName, '.html', function(path) {
    var getCount, got, matchesGet, promise;
    if (path === null) {
      if (!files) {
        // Return without doing anything if the path isn't found, and this is the
        // initial automatic lookup based on the clientName
        return calls.finish(null, {}, {});
      } else {
        return calls.finish(new Error(
          "Can't find file " + fileName
        ));
      }
    }
    files || (files = {});
    templates || (templates = {});
    instances || (instances = {});

    got = false;
    if (get === 'import') {
      matchesGet = function() {
        return got = true;
      }
    } else if (Array.isArray(get)) {
      // TODO: document this case when `get` is an Array
      getCount = get.length;
      matchesGet = function(name) {
        --getCount || (got = true);
        return ~get.indexOf(name);
      }
    } else {
      matchesGet = function(name) {
        got = true;
        return get === name;
      }
    }

    // Ensure that the file under `path` will be read only once. Check that
    // promise for it does not exists, create a new one and read file.
    promise = files[path];
    if (!promise) {
      promise = files[path] = new Promise;
      fs.readFile(path, 'utf8', function(err, file) {
        promise.resolve(err, file);
      });
    }

    // Nevertheless parse file each time `forTemplate` functions is called on
    // it.
    promise.on(function(err, file) {
      if (err) return calls.finish(err);
      try {
        parseTemplateFile(root, dirname(path), path, calls, files, templates, instances, alias, currentNs, matchesGet, file);
      } catch (err) {
        if (err.message) {
          err.message = 'In file ' + path + '\n\n' + err.message;
        }
        return calls.finish(err);
      }
      if (!got && get !== 'import') {
        return calls.finish(new Error(
          "Can't find template '" + get + "' in " + path
        ));
      }
      calls.finish(null, templates, instances);
    });
  });
}

// ## Parse template file (without parsing individual templates)
//
// Not exposed. Used only by `forTemplate` function.

/**
 * Parse template file (without parsing individual templates)
 *
 * Parsing is done using `parse` function exported from `html-util` package.
 *
 * @param  {String} root       [description]
 * @param  {String} dir        [description]
 * @param  {String} path       [description]
 * @param  {Object} calls      Should contain `finish` method, also `incr`
 *                             method, but it is called only from `forTemplate`
 *                             function
 * @param  {Object} files      Needed only to pass it back to the consecutive
 *                             calls to the `forTemplate` function, see it for
 *                             details
 * @param  {Object} templates  [description]
 * @param  {Object} instances  [description]
 * @param  {[type]} alias      [description]
 * @param  {String} currentNs  [description]
 * @param  {Function} matchesGet [description]
 * @param  {String} file       Contents of a template file to parse
 * @return {undefined}            [description]
 */
function parseTemplateFile(root, dir, path, calls, files, templates, instances, alias, currentNs, matchesGet, file) {
  var relativePath = unixRelative(root, path);

  parseHtml(file + '\n', {
    // Force template tags to be treated as raw tags,
    // meaning their contents are not parsed as HTML
    rawTags: /^(?:[^\s=\/!>]+:|style|script)$/i
  , matchEnd: matchEnd
  , start: onStart
  , text: onText
  });

  // `matchEnd` is not bound to syntactical scope
  function matchEnd(tagName) {
    if (tagName.slice(-1) === ':') {
      return /<\/?[^\s=\/!>]+:[\s>]/i;
    }
    return new RegExp('</' + tagName, 'i');
  }

  // These variables pass state from attributes in the start tag to the
  // following template text
  var name, attrs;

  function onStart(tag, tagName, _attrs) {
    var i = tagName.length - 1
    name = (tagName.charAt(i) === ':' ? tagName.slice(0, i) : '').toLowerCase();
    attrs = _attrs;

    if (name === 'import') {
      parseImport(root, dir, path, calls, files, templates, instances, currentNs, attrs)
    }
  }

  function onText(text, isRawText) {
    if (!matchesGet(name)) return;
    if (name === 'import') {
      if (onlyWhitespace(text)) return;
      return calls.finish(new Error(
        "Content not allowed after <import:> in" + path + " : " + text
      ));
    }
    var templateName = relativePath + ':' + name
      , instanceName = alias || name
    if (currentNs) {
      instanceName = currentNs + ':' + instanceName;
    }
    instances[instanceName] = [templateName, attrs];
    if (templates[templateName]) return;
    if (!(name && isRawText)) {
      if (onlyWhitespace(text)) return;
      return calls.finish(new Error(
        "Can't read template in " + path + " near the text: " + text
      ));
    }
    templates[templateName] = minifyHtml(text);
  }
}

function parseImport(root, dir, path, calls, files, templates, instances, currentNs, attrs) {
  var src = attrs.src
    , ns = attrs.ns
    , as = attrs.as
    , template = attrs.template
    , toGet = 'import'
    , srcNs
  if (!src) {
    return calls.finish(new Error(
      "Template import in " + path + " must have a 'src' attribute"
    ));
  }
  if (template) {
    toGet = template.toLowerCase().split(' ');
    if (toGet.length > 1 && (as != null)) {
      return calls.finish(new Error(
        "Template import of '" + src + "' in " + path +
        " can't specify multiple 'template' values with 'as'"
      ));
    }
  }
  if ('ns' in attrs) {
    if (as) {
      return calls.finish(new Error(
        "Template import of '" + src + "' in " + path +
        " can't specifiy both 'ns' and 'as' attributes"
      ));
    }
    // Import into the namespace specified via 'ns' underneath
    // the current namespace
    ns = ns
      ? currentNs ? currentNs + ':' + ns : ns
      : currentNs;
  } else if (as) {
    // If 'as' is specified, import into the current namespace
    ns = currentNs;
  } else {
    // If no namespace is specified, use the src file name
    // as the default namespace
    i = src.lastIndexOf('/');
    srcNs = i ? src.slice(i + 1) : src;
    ns = currentNs ? currentNs + ':' + srcNs : srcNs;
  }
  ns = ns.toLowerCase();
  
  forTemplate(root, join(dir, src), toGet, calls, files, templates, instances, as, ns);
}

function onlyWhitespace(text) {
  // Minify removes HTML comments & linebreaks
  return /^\s*$/.test(minifyHtml(text))
}

// TODO: These should be set as configuration options
var extensions = {
  html: /\.html$/i
, css: /\.styl$|\.css|\.less$/i
, js: /\.js$/i
};

var ignoreDirectories = ['node_modules', '.git', 'gen'];

function ignored(path) {
  return ignoreDirectories.indexOf(path) === -1;
}

function files(dir, extension, out) {
  if (out == null) out = [];
  fs.readdirSync(dir).filter(ignored).forEach(function(p) {
    p = join(dir, p);
    if (fs.statSync(p).isDirectory()) {
      files(p, extension, out);
    } else if (extension.test(p)) {
      out.push(p);
    }
  });
  return out;
}
