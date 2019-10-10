/*
 * files.js
 * load templates and styles from disk
 *
 */

var fs = require('fs');
var path = require('path');
var util = require('racer/lib/util');
var resolve = require('resolve');
var parseViews = require('../parsing').parseViews;

exports.loadViewsSync = loadViewsSync;
exports.loadStylesSync = loadStylesSync;
exports.cssCompiler = cssCompiler;
exports.htmlCompiler = htmlCompiler;

function loadViewsSync(app, sourceFilename, namespace) {
  var views = [];
  var files = [];
  var filename = resolve.sync(sourceFilename, {
    extensions: app.viewExtensions,
    packageFilter: deleteMain}
  );
  if (!filename) {
    throw new Error('View template file not found: ' + sourceFilename);
  }

  var file = fs.readFileSync(filename, 'utf8');

  var extension = path.extname(filename);
  var compiler = app.compilers[extension];
  if (!compiler) {
    throw new Error('Unable to find compiler for: ' + extension);
  }

  function onImport(attrs) {
    var dir = path.dirname(filename);
    var importFilename = resolve.sync(attrs.src, {
      basedir: dir,
      extensions: app.viewExtensions,
      packageFilter: deleteMain
    });
    var extension = path.extname(importFilename);
    var relativeNamespace = (attrs.ns == null) ?
      path.basename(attrs.src, extension) :
      attrs.ns;
    var importNamespace = (namespace && relativeNamespace) ?
      namespace + ':' + relativeNamespace :
      namespace || relativeNamespace || '';
    var imported = loadViewsSync(app, importFilename, importNamespace);
    views = views.concat(imported.views);
    files = files.concat(imported.files);
  }

  var htmlFile = compiler(file, filename);
  var parsedViews = parseViews(namespace, htmlFile, filename, onImport);
  return {
    views: views.concat(parsedViews),
    files: files.concat(filename)
  };
}

function htmlCompiler(file) {
  return file;
}

function loadStylesSync(app, sourceFilename, options) {
  options || (options = {compress: util.isProduction});
  var resolved = resolve.sync(sourceFilename, {
    extensions: app.styleExtensions,
    packageFilter: deleteMain}
  );
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

// Resolve will use a main path from a package.json if found. Main is the
// entry point for javascript in a module, so this will mistakenly cause us to
// load the JS file instead of a view or style file in some cases. This package
// filter deletes the main property so that the normal file name lookup happens
function deleteMain() {
  return {};
}
