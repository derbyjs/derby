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
var util = require('racer/lib/util');
var htmlUtil = require('html-util');
var resolve = require('resolve');

exports.loadViewsSync = loadViewsSync;
exports.loadStylesSync = loadStylesSync;
exports.cssCompiler = cssCompiler;
exports.lessCompiler = lessCompiler;
exports.stylusCompiler = stylusCompiler;

function loadViewsSync(sourceFilename, namespace) {
  var views = [];
  var files = [];
  var resolved = resolve.sync(sourceFilename, {extensions: ['.html']});
  if (!resolved) {
    throw new Error('View template file not found: ' + sourceFilename);
  }
  var file = fs.readFileSync(resolved, 'utf8');
  var parsed = parseViews(namespace, file, resolved);
  for (var i = 0, len = parsed.imports.length; i < len; i++) {
    var item = parsed.imports[i];
    var imported = loadViewsSync(item.filename, item.namespace);
    views = views.concat(imported.views);
    files = files.concat(imported.files);
  }
  return {
    views: views.concat(parsed.views)
  , files: files.concat(resolved)
  };
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
      throw new Error('Expected tag ending in colon (:) instead of ' + tag);
    }
    name = tagName.slice(0, -1);
    attrs = tagAttrs;
    if (name === 'import') {
      var dir = path.dirname(filename);
      imports.push({
        filename: resolve.sync(attrs.src, {basedir: dir, extensions: ['.html']})
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
    , filename: filename
    });
  }

  return {
    imports: imports
  , views: views
  };
}

function loadStylesSync(app, sourceFilename, options) {
  options || (options = {compress: util.isProduction});
  var resolved = resolve.sync(sourceFilename, {extensions: app.styleExtensions});
  if (!resolved) {
    throw new Error('Style file not found: ' + sourceFilename);
  }
  var extension = path.extname(resolved);
  var compiler = app.compilers[extension];
  if (!compiler) {
    throw new Error('Unable to find compiler for: ' + extension);
  }
  var file = fs.readFileSync(resolved, 'utf8');
  return compiler(file, resolved, options);
}

function cssCompiler(file, filename, options) {
  return {css: file, files: [filename]};
}

function lessCompiler(file, filename, options) {
  var parser = new less.Parser({
    paths: [path.dirname(filename)]
  , filename: filename
  , syncImport: true
  });
  var out = {};
  parser.parse(file, function(err, tree) {
    if (err) throw err;
    out.css = tree.toCSS(options);
  });
  out.files = Object.keys(parser.imports.files).map(function(path) {
    return path;
  });
  out.files.push(filename);
  return out;
}

function stylusCompiler(file, filename, options) {
  var css;
  var options = {_imports: []};
  var out = {};
  stylus(file, options)
    .use(nib())
    .set('filename', filename)
    .set('compress', options.compress)
    .set('include css', true)
    .render(function(err, value) {
      if (err) throw err;
      out.css = value;
    });
  out.files = options._imports.map(function(item) {
    return item.path;
  });
  out.files.push(filename);
  return out;
}
