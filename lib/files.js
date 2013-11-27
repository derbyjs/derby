/*
 * files.js
 * loads templates, configurations and other files from disk
 *
 */ 

var fs = require('fs');
var path = require('path');
var async = require('async');
var less = require('less');
var nib = require('nib');
var stylus = require('stylus');
var util = require('racer').util;
var htmlUtil = require('html-util');

exports.importFile = importFile;
exports.importFileSync = importFileSync;
exports.loadViewsSync = loadViewsSync;
exports.loadStyles = loadStyles;
exports.cssCompiler = cssCompiler;
exports.lessCompiler = lessCompiler;
exports.stylusCompiler = stylusCompiler;

function importFile(filename, extension, cb) {
  fs.readFile(filename, 'utf8', function(err, file) {
    if (!err) return cb(null, file, filename);
    if (!extension) return cb(err);
    if (err.code === 'EISDIR') {
      importFile(filename + '/index' + extension, null, cb);
    } else if (err.code === 'ENOENT') {
      importFile(filename + extension, null, cb);
    } else {
      cb(err);
    }
  });
}

function importFileSync(filename, extension) {
  if (fs.existsSync(filename)) {
    var stats = fs.statSync(filename);
    if (stats.isDirectory()) {
      filename += '/index' + extension;
    }
  } else {
    filename += extension;
  }
  return {
    file: fs.readFileSync(filename, 'utf8')
  , filename: filename
  };
}

function loadViewsSync(sourceFilename, namespace) {
  views = [];
  var data = importFileSync(sourceFilename, '.html');
  var parsed = parseViews(namespace, data.file, data.filename);
  for (var i = 0, len = parsed.imports.length; i < len; i++) {
    var item = parsed.imports[i];
    var imported = loadViewsSync(item.filename, item.namespace);
    views = views.concat(imported);
  }
  return views.concat(parsed.views);
}

function parseViews(namespace, file, filename) {
  var imports = [];
  var views = [];

  htmlUtil.parse(file + '\n', {
    // Force view tags to be treated as raw tags,
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
  // following view template text
  var name, attrs;

  function onStart(tag, tagName, tagAttrs) {
    var lastChar = tagName.charAt(tagName.length - 1);
    if (lastChar !== ':') {
      var err = new Error('Expected tag ending in colon (:) instead of ' + tag);
      return group()(err);
    }
    name = tagName.slice(0, -1);
    attrs = tagAttrs;
    if (name === 'import') {
      var dir = path.dirname(filename);
      imports.push({
        filename: path.resolve(dir, attrs.src)
      , namespace: namespace + ':' +
          (attrs.ns || path.basename(attrs.src, '.html'))
      });
    }
  }

  function onText(text, isRawText) {
    if (!name || name === 'import') return;
    views.push({
      name: namespace + ':' + name
    , source: text
    , options: attrs
    });
  }

  return {
    imports: imports
  , views: views
  };
}

function loadStyles(app, sourceFilename, options, cb) {
  options || (options = {compress: util.isProduction});
  async.map(app.styleExtensions, function(extension, mapCb) {
    var compiler = app.compilers[extension];
    if (!compiler) {
      var err = new Error('Unable to find compiler for: ' + extension);
      return mapCb(err);
    }
    importFile(sourceFilename, extension, function(err, file, filename) {
      // Ignore if style file doesn't exist
      if (err && err.code === 'ENOENT') return mapCb('');
      if (err) return mapCb(err);
      compiler(file, filename, options, mapCb);
    });

  }, function(err, results) {
    if (err) return cb(err);
    cb(null, results.join(''));
  });
}

function cssCompiler(file, filename, options, cb) {
  cb(null, file);
}

function lessCompiler(file, filename, options, cb) {
  var parser = new less.Parser({
    paths: [path.dirname(filename)]
  , filename: filename
  });
  parser.parse(file, function(err, tree) {
    if (err) return cb(err);
    try {
      var compiled = tree.toCSS(options);
    } catch (err) {
      return cb(err);
    }
    cb(null, compiled);
  });
}

function stylusCompiler(file, filename, options, cb) {
  stylus(file)
    .use(nib())
    .set('filename', filename)
    .set('compress', options.compress)
    .set('include css', true)
    .import('nib')
    .render(cb);
}
