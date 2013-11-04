/*
 * App.server.js
 *
 * Application level functionality that is 
 * only applicable to the server.
 *
 */

var path = require('path');
var App = require('./App');
var Page = require('./Page');
var files = require('./files');

App.prototype._init = function() {
  var relativePath = path.relative(__dirname, this.module.filename)
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/\//g, '-');
  this.scriptUrl = '/derby/' + encodeURIComponent(relativePath);

  this.views.register('app:Doctype', '<!DOCTYPE html>');
  this.views.register('app:Root', '');
  this.views.register('app:Charset', '<meta charset="utf-8">');
  this.views.register('app:Title', '<title>Derby App</title>');
  this.views.register('app:Head', '');
  this.views.register('app:Styles', '');
  this.views.register('app:Header', '');
  this.views.register('app:Body', '');
  this.views.register('app:Footer', '');
  this.views.register('app:Scripts', '');
  this.views.register('app:Bundle', '');
  this.views.register('app:Tail', '');
};

App.prototype.styleExtensions = ['.css', '.less', '.styl'];

App.prototype.compilers = {
  '.css': files.cssCompiler
, '.less': files.lessCompiler
, '.styl': files.stylusCompiler
};

// Override ready to have no effect on server
App.prototype.ready = function() {};

App.prototype.render = function(res, model, ns, status) {
  var page = new Page(this, model, null, res);
  page.render(ns, status);
};

App.prototype.createPage = function(req, res) {
  return new Page(this, req.getModel(), req, res);
};

App.prototype.onRoute = function(callback, page, params, next, isTransitional, done) {
  this.emit('model', page.model);
  if (isTransitional) {
    if (callback.length === 4) {
      callback(page.model, params, next, done);
      return true;
    } else {
      callback(page.model, params, next);
      return;
    }
  }
  callback(page, page.model, params, next);
};

App.prototype.scripts = function(store) {
  // if (!isProduction) autoRefresh(store, view);

  store.on('bundle', function(browserify) {
    browserify.require(__dirname, {expose: 'derby'});
  });

  this.bundle(store, function(err) {
    if (err) console.error(err.stack || err);
  });

  var app = this;
  function scriptsMiddleware(req, res, next) {
    if (req.url !== app.scriptUrl) return next();
    app.bundle(store, function(err, bundle) {
      if (err) return next(err);
      res.type('js');
      res.send(bundle);
    });
  }
  return scriptsMiddleware;
};

App.prototype.bundle = function(store, cb) {
  store.bundle(this.module.filename, cb);
};

App.prototype.loadViews = function(filename, cb) {
  filename = assetFilename(this, filename, 'views');
  cb || (cb = this._defaultCallback);
  files.loadViews(this.views, filename, 'app', cb);
};

App.prototype.loadStyles = function(filename, options, cb) {
  filename = assetFilename(this, filename, 'styles');
  cb || (cb = this._defaultCallback);
  var app = this;
  files.loadStyles(app, filename, options, function(err, css) {
    if (err) return cb(err);
    app.views.register('app:Styles', '<style id="_css">' + css + '</style>');
    cb();
  });
};

function assetFilename(app, filename, type) {
  if (filename) return filename;
  var dir = path.dirname(app.module.filename);
  return path.dirname(path.dirname(dir)) + '/' + type + '/' + path.basename(dir);
}
