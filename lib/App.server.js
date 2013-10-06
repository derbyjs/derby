var path = require('path');
var App = require('./App');
var Page = require('./Page');

App.prototype._init = function() {
  var relativePath = path.relative(__dirname, this.module.filename)
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/\//g, '-');
  this.scriptUrl = '/derby/' + encodeURIComponent(relativePath);

  this.views.register('Doctype', '<!DOCTYPE html>');
  this.views.register('Root', '');
  this.views.register('Charset', '<meta charset="utf-8">');
  this.views.register('Title', '<title>Derby App</title>');
  this.views.register('Head', '');
  this.views.register('Styles', '');
  this.views.register('Header', '');
  this.views.register('Body', '');
  this.views.register('Footer', '');
  this.views.register('Scripts', '');
  this.views.register('Bundle', '');
  this.views.register('Tail', '');
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

  this.bundle(function(err) {
    if (err) console.error(err.stack || err);
  });

  var app = this;
  function scriptsMiddleware(req, res, next) {
    if (req.url !== app.scriptUrl) return next();
    app.bundle(function(err, bundle) {
      if (err) return next(err);
      res.type('js');
      res.send(bundle);
    });
  }
  return scriptsMiddleware;
};

App.prototype.bundle = function(cb) {
  cb();
};
