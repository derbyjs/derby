/*
 * App.server.js
 *
 * Application level functionality that is 
 * only applicable to the server.
 *
 */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var chokidar = require('chokidar');
var through = require('through');
var derbyTemplates = require('derby-templates');
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
      '<title><view name="{{$render.prefix}}Title"></view></title>' +
      '<view name="{{$render.prefix}}Styles"></view>' +
      '<view name="{{$render.prefix}}Head"></view>' +
    '</head>' +
    '<body class="{{$bodyClass($render.ns)}}">' +
      '<view name="{{$render.prefix}}Body"></view>'
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

App.prototype.scripts = function(store, options) {
  if (!util.isProduction) this._autoRefresh(store);
  var app = this;
  var pending;

  // If the app hasn't been bundled, bundle it and then complete any requests
  // for scripts that may have been pending
  if (!app.script) {
    pending = [];
    // Delay execution here, since the app browserify middleware should be
    // added last, particularly after the socket plugin is added 
    process.nextTick(function() {
      app.bundle(store, options, function(err, source, map) {
        if (err) throw err;
        app.script = source;
        app.scriptMap = map;
        if (!pending) return;
        for (var i = 0, len = pending.length; i < len; i++) {
          var args = pending[i];
          scriptsMiddleware(args[0], args[1], args[2]);
        }
        pending = null;
      });
    });
  }

  function scriptsMiddleware(req, res, next) {
    if (req.url === app.scriptUrl) {
      // Delay response until scripts are loaded
      if (!app.script) return pending.push([req, res, next]);
      res.type('js');
      res.send(app.script);

    } else if (req.url === app.scriptMapUrl) {
      // Delay response until scripts are loaded
      if (!app.scriptMap) return pending.push([req, res, next]);
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
  var bundleFiles = [];
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
    bundle.on('file', function(filename) {
      bundleFiles.push(filename);
    });
  });
  var app = this;
  store.bundle(app.filename, options, function(err, source, map) {
    if (err) return cb(err);
    app.scriptHash = crypto.createHash('md5').update(source).digest('hex');
    source += '\nwindow.DERBY_SCRIPT_HASH=\'' + app.scriptHash + '\'';
    source += '\n//# sourceMappingURL=' + app.scriptMapUrl;
    app._watchBundle(bundleFiles);
    cb(null, source, map);
  });
};

App.prototype._viewsSource = function(options) {
  var minify = (options && options.minify != null) ?
    options.minify : util.isProduction;
  return '/*DERBY_SERIALIZED_VIEWS*/' +
    'module.exports = ' + this.views.serialize({minify: minify}) + ';' +
    '/*DERBY_SERIALIZED_VIEWS_END*/';
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
  serializedViews(derbyTemplates, this.views);
};

App.prototype.loadViews = function(filename, namespace) {
  var data = files.loadViewsSync(filename, namespace);
  for (var i = 0, len = data.views.length; i < len; i++) {
    var item = data.views[i];
    this.views.register(item.name, item.source, item.options);
  }
  this._watchViews(data.files, filename, namespace);
  // Make chainable
  return this;
};

App.prototype.loadStyles = function(filename, options) {
  this._loadStyles(filename, options);
  var stylesView = this.views.find('Styles');
  stylesView.source += '<view name="' + filename + '"></view>';
  // Make chainable
  return this;
};

App.prototype._loadStyles = function(filename, options) {
  var styles = files.loadStylesSync(this, filename, options);
  this.views.register(filename, '<style>' + styles.css + '</style>');
  this._watchStyles(styles.files, filename, options);
};

App.prototype._watchViews = function(filenames, filename, namespace) {
  var app = this;
  var watcher = chokidar.watch(filenames);
  watcher.on('change', function() {
    watcher.close();
    app.loadViews(filename, namespace);
    app._updateScriptViews();
    app._refreshClients();
  });
};

App.prototype._watchStyles = function(filenames, filename, options) {
  var app = this;
  var watcher = chokidar.watch(filenames);
  watcher.on('change', function() {
    watcher.close();
    app._loadStyles(filename, options);
    app._updateScriptViews();
    app._refreshClients();
  });
};

App.prototype._watchBundle = function(filenames) {
  if (!process.send) return;
  var app = this;
  var watcher = chokidar.watch(filenames);
  watcher.on('change', function() {
    watcher.close();
    process.send({type: 'reload'});
  });
};

App.prototype._updateScriptViews = function() {
  if (!this.script) return;
  var i = this.script.indexOf('/*DERBY_SERIALIZED_VIEWS*/');
  var before = this.script.slice(0, i);
  var i = this.script.indexOf('/*DERBY_SERIALIZED_VIEWS_END*/');
  var after = this.script.slice(i + 30);
  this.script = before + this._viewsSource() + after;
};

App.prototype._autoRefresh = function(store) {
  var clients = this.clients = [];
  var app = this;
  store.on('client', function(client) {
    client.channel.on('derby:app', function(data, cb) {
      if (data.name !== app.name) return;
      if (data.hash !== app.scriptHash) return cb('hash mismatch');
      clients.push(client);
      cb();
    });
  });
};

App.prototype._refreshClients = function() {
  if (!this.clients) return;
  var data = this.views.serialize();
  for (var i = this.clients.length; i--;) {
    this.clients[i].channel.send('derby:refreshViews', data);
  }
};
