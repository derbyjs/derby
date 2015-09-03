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
  this.views.register('BootstrapPage',
    '<!DOCTYPE html>' +
    '<meta charset="utf-8">' +
    '<title> </title>' +
    '<view name="{{$render.prefix}}Styles"></view>' +
    '<view name="{{$render.prefix}}Head"></view>',
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
  var model = (req.getModel) ? req.getModel() : new racer.Model();
  if (!model) return;
  this.emit('model', model);
  var page = new this.Page(this, model, req, res);
  if (next) {
    model.on('error', function(err){
      model.hasErrored = true;
      next(err);
    });
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
  store.once('bundle', function(bundle) {
    bundle.require(path.dirname(__dirname), {expose: 'derby'});
    var viewsFilename = path.join(__dirname, './' + app.name + '_views.js');
    fs.writeFileSync(viewsFilename, viewsSource);
    bundle.require(viewsFilename, {expose: 'views'});
    app.emit('bundle', bundle);
  });
  store.bundle(app.filename, options, function(err, source, map) {
    if (err) return cb(err);
    if (!util.isProduction) {
      app._autoRefresh(store);
    }
    cb(null, source, map);
  });
};

App.prototype._writeScripts = function (dir, source, map, options) {
  // Calculate the script hash
  this.scriptHash = crypto.createHash('md5').update(source).digest('hex');
  source = source.replace('{{DERBY_SCRIPT_HASH}}', this.scriptHash);
  source = source.replace(/['"]{{DERBY_BUNDLED_AT}}['"]/, Date.now());
  // Create the derby dir if it doesn't exist
  dir = path.join(dir, 'derby');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  var filename = this.name + '-' + this.scriptHash;
  var base = path.join(dir, filename);
  this.scriptUrl = '/derby/' + filename + '.js';
  // If source maps are enabled, write them
  if (map && !(options && options.disableScriptMap)) {
    this.scriptMapUrl = '/derby/' + filename + '.map.json';
    source += '\n//# sourceMappingURL=' + this.scriptMapUrl;
    this.scriptMapFilename = base + '.map.json';
    fs.writeFileSync(this.scriptMapFilename, map, 'utf8');
  }
  // Write the bundle to disk
  this.scriptFilename = base + '.js';
  fs.writeFileSync(this.scriptFilename, source, 'utf8');
}

App.prototype.writeScripts = function(store, dir, options, cb) {
  var app = this;
  // racer-bundle will call this whenever it rebundles the app
  options.onRebundle = function(source, map, options) {
    app._writeScripts(dir, source, map, options);
    app._refreshScripts();
  };
  this.bundle(store, options, function(err, source, map) {
    if (err) throw err
    app._writeScripts(dir, source, map, options);
    // Delete app bundles with same name in development so files don't
    // accumulate. Don't do this automatically in production, since there could
    // be race conditions with multiple processes intentionally running
    // different versions of the app in parallel out of the same directory,
    // such as during a rolling restart.
    if (!util.isProduction) {
      var filenames = fs.readdirSync(path.join(dir, 'derby'));
      for (var i = 0; i < filenames.length; i++) {
        var item = filenames[i].split(/[-.]/);
        if (item[0] === app.name && item[1] !== app.scriptHash) {
          var oldFilename = path.join(dir, 'derby', filenames[i]);
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
  var viewsSource = this._viewsSource({server: true, minify: true});
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

  var filepath = '';
  if (!util.isProduction) {
    /**
     * Mark the path to file as an attribute
     * Used in development to add event watchers and autorefreshing of styles
     * SEE: local file, method this._watchStyles
     * SEE: file ./App.js, method App._autoRefresh()
     */
    filepath = ' data-filename="' + filename + '"';
  }
  var source = '<style' + filepath + '>' + styles.css + '</style>';

  this.views.register(filename, source, {
    serverOnly: true
  });

  if (!util.isProduction) {
    this._watchStyles(styles.files, filename, options);
  }

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

App.prototype._updateScriptViews = function() {
  if (!this.scriptFilename) return;
  var script = fs.readFileSync(this.scriptFilename, 'utf8');
  var i = script.indexOf('/*DERBY_SERIALIZED_VIEWS*/');
  var before = script.slice(0, i);
  i = script.indexOf('/*DERBY_SERIALIZED_VIEWS_END*/');
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

App.prototype._refreshScripts = function(filename) {
  if (!this.clients) return;
  var data = {filename: filename};
  for (var id in this.clients) {
    this.clients[id].channel.send('derby:refreshScripts', data);
  }
};
