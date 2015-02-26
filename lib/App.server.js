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
var racer = require('racer');
var util = racer.util;
var App = require('./App');
var files = require('./files');

var STYLE_EXTENSIONS = ['.css'];
var VIEW_EXTENSIONS = ['.html'];
var COMPILERS = {
  '.css': files.cssCompiler
, '.html': files.htmlCompiler
};

App.prototype._init = function() {
  this.scriptFilename = null;
  this.scriptMapFilename = null;
  this.scriptUrl = null;
  this.scriptMapUrl = null;
  this.clients = null;
  this.styleExtensions = STYLE_EXTENSIONS.slice();
  this.viewExtensions = VIEW_EXTENSIONS.slice();
  this.compilers = util.copyObject(COMPILERS);

  this.serializedDir = path.dirname(this.filename) + '/derby-serialized';
  this.serializedBase = this.serializedDir + '/' + this.name;
  if (fs.existsSync(this.serializedBase + '.json')) {
    this.deserialize();
    this.loadViews = function() {};
    this.loadStyles = function() {};
    return;
  }
  this.views.register('Page',
    '<!DOCTYPE html>' +
    '<meta charset="utf-8">' +
    '<view name="{{$render.prefix}}TitleElement"></view>' +
    '<view name="{{$render.prefix}}Styles"></view>' +
    '<view name="{{$render.prefix}}Head"></view>' +
    '<view name="{{$render.prefix}}BodyElement"></view>',
    {serverOnly: true}
  );
  this.views.register('TitleElement',
    '<title><view name="{{$render.prefix}}Title"></view></title>'
  );
  this.views.register('BodyElement',
    '<body class="{{$bodyClass($render.ns)}}">' +
      '<view name="{{$render.prefix}}Body"></view>'
  );
  this.views.register('Title', 'Derby App');
  this.views.register('Styles', '', {serverOnly: true});
  this.views.register('Head', '', {serverOnly: true});
  this.views.register('Body', '');
  this.views.register('Tail', '');
};

App.prototype.createPage = function(req, res, next) {
  var model = (req.getModel && req.getModel()) || new racer.Model();
  this.emit('model', model);
  var page = new this.Page(this, model, req, res);
  if (next) {
    model.on('error', next);
    page.on('error', next);
  }
  return page;
};

App.prototype.bundle = function(store, options, cb) {
  var app = this;
  if (typeof options === 'function') {
    cb = options;
    options = null;
  }
  options || (options = {});
  if (options.minify == null) options.minify = util.isProduction;
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
    app.emit('bundle', bundle);
  });
  store.bundle(app.filename, options, function(err, source, map) {
    if (err) return cb(err);
    app.scriptHash = crypto.createHash('md5').update(source).digest('hex');
    source = source.replace('{{DERBY_SCRIPT_HASH}}', app.scriptHash);
    source = source.replace(/['"]{{DERBY_BUNDLED_AT}}['"]/, Date.now());
    if (!util.isProduction) {
      app._autoRefresh(store);
      app._watchBundle(bundleFiles);
    }
    cb(null, source, map);
  });
};

App.prototype.writeScripts = function(store, dir, options, cb) {
  if (arguments.length === 3) (cb = options) && (options = {});
  var app = this;
  this.bundle(store, options, function(err, source, map) {
    if (err) return cb(err);
    dir = path.join(dir, 'derby');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    var filename = app.name + '-' + app.scriptHash;
    var base = path.join(dir, filename);
    app.scriptUrl = '/derby/' + filename + '.js';

    // Write current map and bundle files
    if (!(options && options.disableScriptMap)) {
      app.scriptMapUrl = '/derby/' + filename + '.map.json';
      source += '\n//# sourceMappingURL=' + app.scriptMapUrl;
      app.scriptMapFilename = base + '.map.json';
      fs.writeFileSync(app.scriptMapFilename, map, 'utf8');
    }
    app.scriptFilename = base + '.js';
    fs.writeFileSync(app.scriptFilename, source, 'utf8');

    // Delete app bundles with same name in development so files don't
    // accumulate. Don't do this automatically in production, since there could
    // be race conditions with multiple processes intentionally running
    // different versions of the app in parallel out of the same directory,
    // such as during a rolling restart.
    if (!util.isProduction) {
      var filenames = fs.readdirSync(dir);
      for (var i = 0; i < filenames.length; i++) {
        var item = filenames[i].split(/[-.]/);
        if (item[0] === app.name && item[1] !== app.scriptHash) {
          var oldFilename = path.join(dir, filenames[i]);
          fs.unlinkSync(oldFilename);
        }
      }
    }
    cb && cb();
  });
};

App.prototype._viewsSource = function(options) {
  return '/*DERBY_SERIALIZED_VIEWS*/' +
    'module.exports = ' + this.views.serialize(options) + ';' +
    '/*DERBY_SERIALIZED_VIEWS_END*/';
};

App.prototype.serialize = function() {
  if (!fs.existsSync(this.serializedDir)) {
    fs.mkdirSync(this.serializedDir);
  }
  // Don't minify the views (which doesn't include template source), since this
  // is for use on the server
  var viewsSource = this._viewsSource({server: true, minify: false});
  fs.writeFileSync(this.serializedBase + '.views.js', viewsSource, 'utf8');
  var serialized = JSON.stringify({
    scriptUrl: this.scriptUrl
  , scriptMapUrl: this.scriptMapUrl
  });
  fs.writeFileSync(this.serializedBase + '.json', serialized, 'utf8');
};

App.prototype.deserialize = function() {
  var serializedViews = require(this.serializedBase + '.views.js');
  var serialized = require(this.serializedBase + '.json');
  serializedViews(derbyTemplates, this.views);
  this.scriptUrl = serialized.scriptUrl;
  this.scriptMapUrl = serialized.scriptMapUrl;
};

App.prototype.loadViews = function(filename, namespace) {
  var data = files.loadViewsSync(this, filename, namespace);
  for (var i = 0, len = data.views.length; i < len; i++) {
    var item = data.views[i];
    this.views.register(item.name, item.source, item.options);
  }
  if (!util.isProduction) this._watchViews(data.files, filename, namespace);
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
  // Styles are serverOnly. So in order to achieve Live updates in development
  // we need to mark the style tag to be able to manually find and replace it.
  var source = 
    '<style data-filename="' + filename + '">' + 
      styles.css + 
    '</style>';
  this.views.register(filename, source, {serverOnly: true});
  if (!util.isProduction) this._watchStyles(styles.files, filename, options);
  return styles;
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
    var styles = app._loadStyles(filename, options);
    app._updateScriptViews();
    app._refreshStyles(filename, styles);
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
  if (!this.scriptFilename) return;
  var script = fs.readFileSync(this.scriptFilename, 'utf8');
  var i = script.indexOf('/*DERBY_SERIALIZED_VIEWS*/');
  var before = script.slice(0, i);
  var i = script.indexOf('/*DERBY_SERIALIZED_VIEWS_END*/');
  var after = script.slice(i + 30);
  var viewsSource = this._viewsSource();
  fs.writeFileSync(this.scriptFilename, before + viewsSource + after, 'utf8');
};

App.prototype._autoRefresh = function(store) {
  var clients = this.clients = {};
  var app = this;
  store.on('client', function(client) {
    client.on('close', function() {
      delete clients[client.id];
    });
    client.channel.on('derby:app', function(data, cb) {
      if (data.name !== app.name) return;
      if (data.hash !== app.scriptHash) return cb('hash mismatch');
      clients[client.id] = client;
      cb();
    });
  });
};

App.prototype._refreshClients = function() {
  if (!this.clients) return;
  var data = this.views.serialize({minify: true});
  for (var id in this.clients) {
    this.clients[id].channel.send('derby:refreshViews', data);
  }
};

App.prototype._refreshStyles = function(filename, styles) {
  if (!this.clients) return;
  var data = {filename: filename, css: styles.css};
  for (var id in this.clients) {
    this.clients[id].channel.send('derby:refreshStyles', data);
  }
};
