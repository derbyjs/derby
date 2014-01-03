/*
 * files.js
 * loads templates, configurations and other files from disk
 *
 */ 

var fs = require('fs');
var path = require('path');
var less = require('less');
var nib = require('nib');
var stylus = require('stylus');
var util = require('racer').util;
var htmlUtil = require('html-util');

exports.importFileSync = importFileSync;
exports.loadViewsSync = loadViewsSync;
exports.loadStylesSync = loadStylesSync;
exports.cssCompiler = cssCompiler;
exports.lessCompiler = lessCompiler;
exports.stylusCompiler = stylusCompiler;

function FileData(filename) {
  this.file = fs.readFileSync(filename, 'utf8');
  this.filename = filename;
}

function importFileSync(filename, extension) {
  filename = path.join(filename);
  if (fs.existsSync(filename)) {
    var stats = fs.statSync(filename);
    if (stats.isDirectory()) {
      filename += '/index' + extension;
    } else {
      return new FileData(filename);
    }
  } else {
    filename += extension;
  }
  if (fs.existsSync(filename)) {
    return new FileData(filename);
  }
}

function loadViewsSync(sourceFilename, namespace) {
  var views = [];
  var data = importFileSync(sourceFilename, '.html');
  if (!data) {
    throw new Error('View template file not found: ' + sourceFilename);
  }
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
  var prefix = (namespace) ? namespace + ':' : '';

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
      , namespace: prefix + (attrs.ns || path.basename(attrs.src, '.html'))
      });
    }
  }

  function onText(text, isRawText) {
    if (!name || name === 'import') return;
    views.push({
      name: prefix + name
    , source: text
    , options: attrs
    });
  }

  return {
    imports: imports
  , views: views
  };
}

function loadStylesSync(app, sourceFilename, options) {
  options || (options = {compress: util.isProduction});

  var results = app.styleExtensions.map(function(extension) {
    var compiler = app.compilers[extension];
    if (!compiler) {
      throw new Error('Unable to find compiler for: ' + extension);
    }
    var data = importFileSync(sourceFilename, extension);
    // Ignore if style file doesn't exist
    if (!data) return '';
    return compiler(data.file, data.filename, options);
  });
  return results.join('');
}

function cssCompiler(file, filename, options) {
  return file;
}

function lessCompiler(file, filename, options) {
  var parser = new less.Parser({
    paths: [path.dirname(filename)]
  , filename: filename
  , syncImport: true
  });
  return parser.parse(file, function(err, tree) {
    if (err) throw err;
    return tree.toCSS(options);
  });
}

function stylusCompiler(file, filename, options) {
  var css;
  stylus(file)
    .use(nib())
    .set('filename', filename)
    .set('compress', options.compress)
    .set('include css', true)
    .render(function(err, value) {
      if (err) throw err;
      css = value;
    });
  return css;
}
