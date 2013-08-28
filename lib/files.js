var pathUtil = require('path')
  , fs = require('fs')
  , async = require('async')
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
  , htmlUtil = require('html-util')
  , parseHtml = htmlUtil.parse
  , minifyHtml = htmlUtil.minify
  , styleCompilers = {
      stylus: stylusCompiler
    , less: lessCompiler
    , css: cssCompiler
    }
  , derby = require('./derby')
  , isWindows = process.platform === 'win32'

exports.css = css;
exports.templates = templates;
exports.library = library;
exports.parseName = parseName;
exports.hashFile = hashFile;
exports.genInfo = genInfo;
exports.writeGen = writeGen;
exports.writeJs = writeJs;
exports.watch = watch;

function css(root, clientName, compress, callback) {
  root += '/styles';

  var compilerNames = ['css', 'less', 'stylus'];

  async.map(compilerNames, function(compilerName, cb) {
    var compiler = styleCompilers[compilerName];
    if (!compiler) return cb(new Error('Unable to find compiler for: ' + compilerName));
    compiler(root, clientName, compress, function(err, value) {
      if (err) return cb(err);
      cb(null, value || '');
    });

  }, function(err, results) {
    if (err) return callback(err);
    callback(err, results.join(''));
  });
}

function cssCompiler(root, clientName, compress, callback) {
  findPath(root, clientName, '.css', function(path) {
    if (!path) return callback('');
    fs.readFile(path, 'utf8', callback);
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

function stylusCompiler(root, clientName, compress, callback) {
  findPath(root, clientName, '.styl', function(path) {
    if (!path) return callback('');
    fs.readFile(path, 'utf8', function(err, styl) {
      if (err) return callback(err);
      stylus(styl)
        .use(nib())
        .set('filename', path)
        .set('compress', compress)
        .set('include css', true)
        .render(callback);
    });
  });
}

function templates(root, clientName, callback) {
  loadTemplates(root + '/views', clientName, callback);
}

function library(root, callback) {
  var components = {};

  fs.readdir(root, function(err, files) {
    if (err) return callback(err);
    async.forEach(files, libraryFile, function(err) {
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

function parseName(parentFilename) {
  var parentDir = dirname(parentFilename)
    , root = parentDir
    , base = basename(basename(parentFilename, '.js'), '.coffee')
  if (base === 'index') {
    base = basename(parentDir);
    root = dirname(dirname(parentDir));
  } else if (basename(parentDir) === 'lib') {
    root = dirname(parentDir);
  }
  return {
    root: root
  , clientName: base
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

function genInfo(root, filename, isPackage) {
  var staticRoot = derby.get('staticRoot') || join(root, 'public')
    , staticMount = derby.get('staticMount') || ''
    , staticDir = isPackage
        ? derby.get('staticPackageDir') || '/genpack'
        : derby.get('staticDir') || '/gen'
    , staticPath = join(staticRoot, staticDir)
    , filePath = join(staticPath, filename)
    , relativePath = join(staticMount, staticDir, filename)
  return {
    staticPath: staticPath
  , staticRoot: staticRoot
  , filePath: filePath
  , relativePath: relativePath
  }
}

function writeGen(root, filename, file, isPackage, callback) {
  var info = genInfo(root, filename, isPackage)
  function finish(err) {
    if (err) return callback(err);
    fs.writeFile(info.filePath, file, function(err) {
      callback(err, info.relativePath);
    });
  }
  exists(info.staticPath, function(value) {
    if (value) return finish();

    fs.mkdir(info.staticRoot, '0777', function(err) {
      // Not a problem if the directory already exists
      if (err && err.code !== 'EEXIST') return finish(err);
      fs.mkdir(info.staticPath, '0777', function(err) {
        // Not a problem if the directory already exists
        if (err && err.code !== 'EEXIST') return finish(err);
        finish();
      });
    });
  });
}

function writeJs(root, file, isPackage, callback) {
  var hash = hashFile(file);
  var filename = hash + '.js';
  writeGen(root, filename, file, isPackage, function(err, relativePath) {
    callback(err, relativePath, hash);
  });
}

function watch(dir, type, onChange) {
  var extension = extensions[type];
  var hashes = {};
  var watcher = new chokidar.FSWatcher;

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

function hasKeys(object) {
  for (var key in object) {
    return true;
  }
  return false;
}

function forTemplate(root, fileName, get, calls, files, templates, instances, alias, currentNs) {
  if (currentNs == null) currentNs = '';
  calls.incr();
  findPath(root, fileName, '.html', function(path) {
    var getCount, got, matchesGet;
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

    fs.readFile(path, 'utf8', function(err, file) {
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
    for (var key in attrs) {
      if (attrs[key] === null) attrs[key] = true;
    }

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
    templates[templateName] = attrs.literal ? text : trimTemplate(text);
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
  return /^\s*$/.test(minifyHtml(text));
}

function trimTemplate(text) {
  return minifyHtml(text).replace(/&sp;/g, ' ');
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
