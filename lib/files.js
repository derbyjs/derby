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
  , onlyWhitespace = /^[\s\n]*$/
  , isWindows = process.platform === 'win32'

exports.css = css;
exports.templates = templates;
exports.js = js;
exports.library = library;
exports.parseName = parseName;
exports.hashFile = hashFile;
exports.writeJs = writeJs;
exports.watch = watch;

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

function templates(root, clientName, callback) {
  loadTemplates(root + '/views', clientName, callback);
}

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

function unixRelative(from, to) {
  var path = relative(from, to);
  return isWindows ? path.replace(/\\/g, '/') : path;
}

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
        return calls.finish(new Error("Can't find file " + fileName));
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

    promise = files[path];
    if (!promise) {
      promise = files[path] = new Promise;
      fs.readFile(path, 'utf8', function(err, file) {
        promise.resolve(err, file);
      });
    }
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
        return calls.finish(new Error("Can't find template '" + get + "' in " + path));
      }
      calls.finish(null, templates, instances);
    });
  });
}

function parseTemplateFile(root, dir, path, calls, files, templates, instances, alias, currentNs, matchesGet, file) {
  var relativePath = unixRelative(root, path)
    , as, importTemplates, name, ns, src, templateOptions;

  parseHtml(file, {
    // Force template tags to be treated as raw tags,
    // meaning their contents are not parsed as HTML
    rawTags: /^(?:[^\s=\/!>]+:|style|script)$/i
  , matchEnd: matchEnd
  , start: onStart
  , text: onText
  });

  function matchEnd(tagName) {
    if (tagName.slice(-1) === ':') {
      return /<\/?[^\s=\/!>]+:[\s>]/i;
    }
    return new RegExp('</' + tagName, 'i');
  }

  function onStart(tag, tagName, attrs) {
    var i = tagName.length - 1
      , srcNs, template;

    as, importTemplates, ns, src = null;
    name = (tagName.charAt(i) === ':' ? tagName.slice(0, i) : '').toLowerCase();
    if (name === 'import') {
      src = attrs.src, ns = attrs.ns, as = attrs.as, template = attrs.template;
      if (!src) {
        calls.finish(new Error("Template import in " + path +
          " must have a 'src' attribute"));
      }
      if (template) {
        importTemplates = template.toLowerCase().split(' ');
        if (importTemplates.length > 1 && (as != null)) {
          calls.finish(new Error("Template import of '" + src + "' in " +
            path + " can't specify multiple 'template' values with 'as'"));
        }
      }
      if ('ns' in attrs) {
        if (as) calls.finish(new Error("Template import of '" + src +
          "' in " + path + " can't specifiy both 'ns' and 'as' attributes"));
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
    } else {
      templateOptions = attrs;
    }
  }

  function onText(text, isRawText) {
    var instanceName, templateName, toGet;
    if (!matchesGet(name)) return;
    if (src) {
      // Minify to remove comments
      if (/\S/.test(minifyHtml(text))) {
        calls.finish(new Error("Template import of '" + src + "' in " +
          path + " can't contain content: " + text));
      }
      toGet = importTemplates || 'import';
      return forTemplate(root, join(dir, src), toGet, calls, files, templates, instances, as, ns);
    }
    templateName = relativePath + ':' + name;
    instanceName = alias || name;
    if (currentNs) {
      instanceName = currentNs + ':' + instanceName;
    }
    instances[instanceName] = [templateName, templateOptions];
    if (templates[templateName]) return;
    if (!(name && isRawText)) {
      if (onlyWhitespace.test(text)) return;
      calls.finish(new Error("Can't read template in " + path +
        " near the text: " + text));
    }
    templates[templateName] = minifyHtml(text);
  }
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
