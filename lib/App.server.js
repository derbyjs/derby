/*
 * App.server.js
 *
 * Application level functionality that is 
 * only applicable to the server.
 *
 */

var path = require('path');
var App = require('./App');
var files = require('./files');

App.prototype._init = function() {
  var relativePath = path.relative(__dirname, this.module.filename)
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/\//g, '-');
  this.scriptUrl = '/derby/' + encodeURIComponent(relativePath);

  // The <html> and <body> elements are intentially not closed, because
  // Page::render sends an additional script tag after rendering this template.
  // Not closing these tags is totally valid HTML.
  // 
  // While optional in HTML, tags such as <html>, <head>, <body>, <tbody>, etc.
  // MUST be specified in templates, so that the DOM created by the server
  // page render matches the same exact structure as the templates. When
  // displaying HTML, browsers will add DOM nodes for these implied elements
  this.views.register('app:Page',
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<title>{{view $render.prefix + "Title"}}</title>' +
      '{{view $render.prefix + "Styles"}}' +
      '{{view $render.prefix + "Head"}}' +
    '</head>' +
    '<body class="{{$render.bodyClass}}">' +
      '{{view $render.prefix + "Body"}}'
  );
  this.views.register('app:Title', 'Derby App');
  this.views.register('app:Styles', '');
  this.views.register('app:Head', '');
  this.views.register('app:Body', '');
};

App.prototype.styleExtensions = ['.css', '.less', '.styl'];

App.prototype.compilers = {
  '.css': files.cssCompiler
, '.less': files.lessCompiler
, '.styl': files.stylusCompiler
};

App.prototype.render = function(res, model, ns, status) {
  var page = new this.Page(this, model, null, res);
  page.render(ns, status);
};

App.prototype.createPage = function(req, res) {
  return new this.Page(this, req.getModel(), req, res);
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
    browserify.require(path.dirname(__dirname), {expose: 'derby'});
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

App.prototype.loadViews = function(filename) {
  filename = assetFilename(this, filename, 'views');
  var items = files.loadViewsSync(filename, 'app');
  for (var i = 0, len = items.length; i < len; i++) {
    var item = items[i];
    this.views.register(item.name, item.source, item.options);
  }
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
