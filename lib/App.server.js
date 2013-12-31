/*
 * App.server.js
 *
 * Application level functionality that is 
 * only applicable to the server.
 *
 */

var fs = require('fs');
var path = require('path');
var through = require('through');
var expressions = require('derby-expressions').expressions;
var templates = require('derby-templates');
var util = require('racer').util;
var App = require('./App');
var files = require('./files');

App.prototype._init = function() {
  this.script = null;
  this.scriptMap = null;
  this.scriptUrl = '/derby/' + this.name;
  this.scriptMapUrl = this.scriptUrl + '.map';

  this.serializedDir = path.dirname(this.filename) + '/serialized';
  if (fs.existsSync(this.serializedDir)) {
    this.deserialize();
    this.loadViews = function() {};
    this.loadStyles = function() {};
    return;
  }
  // The <html> and <body> elements are intentially not closed, because
  // Page::render sends an additional script tag after rendering this template.
  // Not closing these tags is totally valid HTML.
  // 
  // While optional in HTML, tags such as <html>, <head>, <body>, <tbody>, etc.
  // MUST be specified in templates, so that the DOM created by the server
  // page render matches the same exact structure as the templates. When
  // displaying HTML, browsers will add DOM nodes for these implied elements
  this.views.register('Page',
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<title>{{view $render.prefix + "Title"}}</title>' +
      '{{view $render.prefix + "Styles"}}' +
      '{{view $render.prefix + "Head"}}' +
    '</head>' +
    '<body class="{{$bodyClass($render.ns)}}">' +
      '{{view $render.prefix + "Body"}}'
  );
  this.views.register('Title', 'Derby App');
  this.views.register('Styles', '');
  this.views.register('Head', '');
  this.views.register('Body', '');
};

App.prototype.styleExtensions = ['.css', '.less', '.styl'];

App.prototype.compilers = {
  '.css': files.cssCompiler
, '.less': files.lessCompiler
, '.styl': files.stylusCompiler
};

App.prototype.createPage = function(req, res, next) {
  var model = req.getModel();
  this.emit('model', model);
  var page = new this.Page(this, model, req, res);
  if (next) {
    model.on('error', next);
    page.on('error', next);
  }
  return page;
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

App.prototype.scripts = function(store, options) {
  // if (!isProduction) autoRefresh(store, view);
  var app = this;

  // If the app hasn't been bundled, bundle it and then complete any requests
  // for scripts that may have been pending
  if (!app.script) {
    var pending = [];
    // Delay execution here, since the app browserify middleware should be
    // added last, particularly after the socket plugin is added 
    process.nextTick(function() {
      app.bundle(store, options, function(err, source, map) {
        if (err) throw err;
        app.script = source;
        app.scriptMap = map;
        if (!pending) return;
        for (var i = 0, len = pending.length; i < len; i++) {
          pending[i]();
        }
        pending = null;
      });
    });
  }

  function scriptsMiddleware(req, res, next) {
    if (req.url === app.scriptUrl) {
      // Delay response until scripts are loaded
      if (!app.script) return pending.push(function() {
        scriptsMiddleware(req, res, next);
      });
      res.type('js');
      res.send(app.script);

    } else if (req.url === app.scriptMapUrl) {
      // Delay response until scripts are loaded
      if (!app.script) return pending.push(function() {
        scriptsMiddleware(req, res, next);
      });
      res.type('json');
      res.send(app.scriptMap);

    } else {
      next();
    }
  }
  return scriptsMiddleware;
};

App.prototype.bundle = function(store, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = null;
  }
  // Turn all of the app's currently registered views into a javascript
  // function that can recreate them in the client
  var viewsSource = this._viewsSource(options);
  store.once('bundle', function(bundle) {
    bundle.require(path.dirname(__dirname), {expose: 'derby'});
    // Hack to inject the views script into the Browserify bundle by replacing
    // the empty _views.js file with the generated source
    var viewsFilename = require.resolve('./_views');
    bundle.transform(function(filename) {
      if (filename !== viewsFilename) return through();
      return through(
        function write() {}
      , function end() {
          this.queue(viewsSource);
          this.queue(null);
        }
      );
    });
  });
  var app = this;
  store.bundle(app.filename, options, function(err, source, map) {
    if (err) return cb(err);
    source += '\n//# sourceMappingURL=' + app.scriptMapUrl;
    cb(null, source, map);
  });
};

App.prototype._viewsSource = function(options) {
  var minify = (options && options.minify != null) ?
    options.minify : util.isProduction;
  return 'module.exports = ' + this.views.serialize({minify: minify}) + ';\n';
};

App.prototype.serialize = function(store, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = null;
  }
  var serializedDir = this.serializedDir;
  // Don't pass options to viewsSource, since we want to keep the source
  // for better debugging on the server
  var viewsSource = this._viewsSource();
  this.bundle(store, options, function(err, source, map, viewsSource) {
    if (err) return cb(err);
    if (!fs.existsSync(serializedDir)) {
      fs.mkdirSync(serializedDir);
    }
    fs.writeFileSync(serializedDir + '/script.js', source, 'utf8');
    fs.writeFileSync(serializedDir + '/script.map', map, 'utf8');
    fs.writeFileSync(serializedDir + '/views.js', viewsSource, 'utf8');
    cb();
  });
};

App.prototype.deserialize = function() {
  this.script = fs.readFileSync(this.serializedDir + '/script.js');
  this.scriptMap = fs.readFileSync(this.serializedDir + '/script.map');
  var serializedViews = require(this.serializedDir + '/views.js');
  serializedViews(templates, expressions, this.views);
};

App.prototype.loadViews = function(filename) {
  var items = files.loadViewsSync(filename);
  for (var i = 0, len = items.length; i < len; i++) {
    var item = items[i];
    this.views.register(item.name, item.source, item.options);
  }
};

App.prototype.loadStyles = function(filename, options) {
  var css = files.loadStylesSync(this, filename, options)
  this.views.register('Styles', '<style id="_css">' + css + '</style>');
};
