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

App.prototype._init = function(options) {
  this.scriptFilename = null;
  this.scriptMapFilename = null;
  this.scriptBaseUrl = (options && options.scriptBaseUrl) || '';
  this.scriptMapBaseUrl = (options && options.scriptMapBaseUrl) || '';
  this.scriptCrossOrigin = (options && options.scriptCrossOrigin) || false;
  this.scriptUrl = null;
  this.scriptMapUrl = null;
  this.agents = null;
  this.styleExtensions = STYLE_EXTENSIONS.slice();
  this.viewExtensions = VIEW_EXTENSIONS.slice();
  this.compilers = util.copyObject(COMPILERS);

  this.serializedDir = path.dirname(this.filename || '') + '/derby-serialized';
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
    '<view is="{{$render.prefix}}TitleElement"></view>' +
    '<view is="{{$render.prefix}}Styles"></view>' +
    '<view is="{{$render.prefix}}Head"></view>' +
    '<view is="{{$render.prefix}}BodyElement"></view>',
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
    '<title><view is="{{$render.prefix}}Title"></view></title>'
  );
  this.views.register('BodyElement',
    '<body class="{{$bodyClass($render.ns)}}">' +
      '<view is="{{$render.prefix}}Body"></view>'
  );
  this.views.register('Title', 'Derby App');
  this.views.register('Styles', '', {serverOnly: true});
  this.views.register('Head', '', {serverOnly: true});
  this.views.register('Body', '');
  this.views.register('Tail', '');
};

App.prototype.createPage = function(req, res, next) {
  var model = req.model || new racer.Model();
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

App.prototype.bundle = function(backend, options, cb) {
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
  backend.once('bundle', function(bundle) {
    bundle.require(path.dirname(__dirname), {expose: 'derby'});
    var viewsFilename = path.join(__dirname, './' + app.name + '_views.js');
    fs.writeFileSync(viewsFilename, viewsSource);
    bundle.require(viewsFilename, {expose: 'views'});
    bundle.on('file', function(filename) {
      bundleFiles.push(filename);
    });
    app.emit('bundle', bundle);
  });
  backend.bundle(app.filename, options, function(err, source, map) {
    if (err) return cb(err);
    if (!util.isProduction) {
      app._autoRefresh(backend);
      app._watchBundle(bundleFiles);
    }
    cb(null, source, map);
  });
};

App.prototype._writeScripts = function (dir, source, map, options) {
  var app = this;

  // Calculate the script hash
  app.scriptHash = crypto.createHash('md5').update(source).digest('hex');
  source = source.replace('{{DERBY_SCRIPT_HASH}}', app.scriptHash);
  source = source.replace(/['"]{{DERBY_BUNDLED_AT}}['"]/, Date.now());

  // Create the derby dir if it doesn't exist
  dir = path.join(dir, 'derby');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  var filename = app.name + '-' + app.scriptHash;
  var base = path.join(dir, filename);
  app.scriptUrl = '/derby/' + filename + '.js';

  // Write current map and bundle files
  if (!(options && options.disableScriptMap)) {
    app.scriptMapUrl = app.scriptMapBaseUrl +  '/derby/' + filename + '.map.json';
    source += '\n//# sourceMappingURL=' + app.scriptMapUrl;
    app.scriptMapFilename = base + '.map.json';
    fs.writeFileSync(app.scriptMapFilename, map, 'utf8');
  }
  // Write the bundle to disk
  app.scriptFilename = base + '.js';
  fs.writeFileSync(app.scriptFilename, source, 'utf8');
}

App.prototype.writeScripts = function(backend, dir, options, cb) {
  var app = this;
  // racer-bundle will call this whenever it rebundles the app
  options.onRebundle = function(source, map, options) {
    app._writeScripts(dir, source, map, options);
    app._refreshScripts();
  };
  this.bundle(backend, options, function(err, source, map) {
    if (err) return cb(err);
    app._writeScripts(dir, source, map, options);
    // Delete app bundles with same name in development so files don't
    // accumulate. Don't do this automatically in production, since there could
    // be race conditions with multiple processes intentionally running
    // different versions of the app in parallel out of the same directory,
    // such as during a rolling restart.
    if (!util.isProduction) {
      var appPrefix = app.name + '-';
      var currentBundlePrefix = appPrefix + app.scriptHash;
      var filenames = fs.readdirSync(dir);
      for (var i = 0; i < filenames.length; i++) {
        var filename = filenames[i];
        if (filename.indexOf(appPrefix) !== 0) {
          // Not a bundle for this app, skip.
          continue;
        }
        if (filename.indexOf(currentBundlePrefix) === 0) {
          // Current (newly written) bundle for this app, skip.
          continue;
        }
        // Older bundle for this app, clean it up.
        var oldFilename = path.join(dir, filename);
        fs.unlinkSync(oldFilename);
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
  var scriptUrl = (this.scriptUrl.indexOf(this.scriptBaseUrl) === 0) ?
    this.scriptUrl.slice(this.scriptBaseUrl.length) :
    this.scriptUrl;
  var scriptMapUrl = (this.scriptMapUrl.indexOf(this.scriptMapBaseUrl) === 0) ?
    this.scriptMapUrl.slice(this.scriptMapBaseUrl.length) :
    this.scriptMapUrl;
  var serialized = JSON.stringify({
    scriptBaseUrl: this.scriptBaseUrl
  , scriptMapBaseUrl: this.scriptMapBaseUrl
  , scriptUrl: scriptUrl
  , scriptMapUrl: scriptMapUrl
  });
  fs.writeFileSync(this.serializedBase + '.json', serialized, 'utf8');
};

App.prototype.deserialize = function() {
  var serializedViews = require(this.serializedBase + '.views.js');
  var serialized = require(this.serializedBase + '.json');
  serializedViews(derbyTemplates, this.views);
  this.scriptUrl = (this.scriptBaseUrl || serialized.scriptBaseUrl) + serialized.scriptUrl;
  this.scriptMapUrl = (this.scriptMapBaseUrl || serialized.scriptMapBaseUrl) + serialized.scriptMapUrl;
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
  stylesView.source += '<view is="' + filename + '"></view>';
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
  var viewsSource = this._viewsSource();
  var viewsFilename = path.join(__dirname, './' + this.name + '_views.js');
  fs.writeFileSync(viewsFilename, viewsSource);
};

App.prototype._autoRefresh = function(backend) {
  var agents = this.agents = {};
  var app = this;

  backend.use('receive', function(request, next) {
    var data = request.data;
    if (data.derby) {
      return app._handleMessage(request.agent, data.derby, data);
    }
    next();
  });
};

App.prototype._handleMessage = function(agent, action, message) {
  if (action === 'app') {
    if (message.name !== this.name) {
      return;
    }
    if (message.hash !== this.scriptHash) {
      return agent.send({derby: 'reload'});
    }
    this._addAgent(agent);
  }
};

App.prototype._addAgent = function(agent) {
  this.agents[agent.clientId] = agent;
  var app = this;
  agent.stream.once('end', function() {
    delete app.agents[agent.clientId];
  });
};

App.prototype._refreshClients = function() {
  if (!this.agents) return;
  var views = this.views.serialize({minify: true});
  var message = {
    derby: 'refreshViews',
    views: views
  };
  for (var id in this.agents) {
    this.agents[id].send(message);
  }
};

App.prototype._refreshStyles = function(filename, styles) {
  if (!this.agents) return;
  var data = {filename: filename, css: styles.css};
  var message = {
    derby: 'refreshStyles',
    filename: filename,
    css: styles.css
  };
  for (var id in this.agents) {
    this.agents[id].send(message);
  }
};
