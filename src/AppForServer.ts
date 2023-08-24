/*
 * App.server.js
 *
 * Application level functionality that is
 * only applicable to the server.
 *
 */

var racer = require('racer');
var util = racer.util;
var App = require('./App');
var parsing = require('./parsing');
var derbyTemplates = require('./templates');

// Avoid Browserifying these dependencies
var chokidar, files, fs, path;
if (module.require) {
  chokidar = module.require('chokidar');
  files = module.require('./files');
  fs = module.require('fs');
  path = module.require('path');
}

var STYLE_EXTENSIONS = ['.css'];
var VIEW_EXTENSIONS = ['.html'];
var COMPILERS = {
  '.css': cssCompiler,
  '.html': htmlCompiler
};

function cssCompiler(file, filename, _options) {
  return {css: file, files: [filename]};
}

function htmlCompiler(file) {
  return file;
}

module.exports = AppForServer;

function AppForServer(derby, name, filename, options) {
  App.call(this, derby, name, filename, options);
}
AppForServer.prototype = Object.create(App.prototype);
AppForServer.prototype.constructor = AppForServer;

AppForServer.prototype._init = function(options) {
  this._initBundle(options);
  this._initRefresh();
  this._initLoad();
  this._initViews();
};
AppForServer.prototype._initBundle = function(options) {
  this.scriptFilename = null;
  this.scriptMapFilename = null;
  this.scriptBaseUrl = (options && options.scriptBaseUrl) || '';
  this.scriptMapBaseUrl = (options && options.scriptMapBaseUrl) || '';
  this.scriptCrossOrigin = (options && options.scriptCrossOrigin) || false;
  this.scriptUrl = null;
  this.scriptMapUrl = null;
};
AppForServer.prototype._initRefresh = function() {
  this.watchFiles = !util.isProduction;
  this.agents = null;
};
AppForServer.prototype._initLoad = function() {
  this.styleExtensions = STYLE_EXTENSIONS.slice();
  this.viewExtensions = VIEW_EXTENSIONS.slice();
  this.compilers = util.copyObject(COMPILERS);
};
AppForServer.prototype._initViews = function() {
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

AppForServer.prototype.createPage = function(req, res, next) {
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

AppForServer.prototype.bundle = function(_backend, _options, _cb) {
  throw new Error(
    'bundle implementation missing; use racer-bundler for implementation, or remove call to this method and use another bundler',
  );
};

AppForServer.prototype.writeScripts = function(_backend, _dir, _options, _cb) {
  throw new Error(
    'writeScripts implementation missing; use racer-bundler for implementation, or remove call to this method and use another bundler',
  );
};

AppForServer.prototype._viewsSource = function(options) {
  return `/*DERBY_SERIALIZED_VIEWS ${this.name}*/\n` +
    'module.exports = ' + this.views.serialize(options) + ';\n' +
    `/*DERBY_SERIALIZED_VIEWS_END ${this.name}*/\n`;
};

AppForServer.prototype.serialize = function() {
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
    scriptBaseUrl: this.scriptBaseUrl,
    scriptMapBaseUrl: this.scriptMapBaseUrl,
    scriptUrl: scriptUrl,
    scriptMapUrl: scriptMapUrl
  });
  fs.writeFileSync(this.serializedBase + '.json', serialized, 'utf8');
};

AppForServer.prototype.deserialize = function() {
  var serializedViews = require(this.serializedBase + '.views.js');
  var serialized = require(this.serializedBase + '.json');
  serializedViews(derbyTemplates, this.views);
  this.scriptUrl = (this.scriptBaseUrl || serialized.scriptBaseUrl) + serialized.scriptUrl;
  this.scriptMapUrl = (this.scriptMapBaseUrl || serialized.scriptMapBaseUrl) + serialized.scriptMapUrl;
};

AppForServer.prototype.loadViews = function(filename, namespace) {
  var data = files.loadViewsSync(this, filename, namespace);
  parsing.registerParsedViews(this, data.views);
  if (this.watchFiles) this._watchViews(data.files, filename, namespace);
  // Make chainable
  return this;
};

AppForServer.prototype.loadStyles = function(filename, options) {
  this._loadStyles(filename, options);
  var stylesView = this.views.find('Styles');
  stylesView.source += '<view is="' + filename + '"></view>';
  // Make chainable
  return this;
};

AppForServer.prototype._loadStyles = function(filename, options) {
  var styles = files.loadStylesSync(this, filename, options);

  var filepath = '';
  if (this.watchFiles) {
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

  if (this.watchFiles) {
    this._watchStyles(styles.files, filename, options);
  }

  return styles;
};

AppForServer.prototype._watchViews = function(filenames, filename, namespace) {
  var app = this;
  watchOnce(filenames, function() {
    app.loadViews(filename, namespace);
    app._updateScriptViews();
    app._refreshClients();
  });
};

AppForServer.prototype._watchStyles = function(filenames, filename, options) {
  var app = this;
  watchOnce(filenames, function() {
    var styles = app._loadStyles(filename, options);
    app._updateScriptViews();
    app._refreshStyles(filename, styles);
  });
};

AppForServer.prototype._watchBundle = function(filenames) {
  if (!process.send) return;
  watchOnce(filenames, function() {
    process.send({type: 'reload'});
  });
};

function watchOnce(filenames, callback) {
  var watcher = chokidar.watch(filenames);
  var closed = false;
  watcher.on('change', function() {
    if (closed) return;
    closed = true;
    // HACK: chokidar 3.1.1 crashes when you synchronously call close
    // in the change event. Delaying appears to prevent the crash
    process.nextTick(function() {
      watcher.close();
    });
    callback();
  });
}

AppForServer.prototype._updateScriptViews = function() {
  if (!this.scriptFilename) return;
  var script = fs.readFileSync(this.scriptFilename, 'utf8');
  var i = script.indexOf('/*DERBY_SERIALIZED_VIEWS*/');
  var before = script.slice(0, i);
  var i = script.indexOf('/*DERBY_SERIALIZED_VIEWS_END*/');
  var after = script.slice(i + 30);
  var viewsSource = this._viewsSource();
  fs.writeFileSync(this.scriptFilename, before + viewsSource + after, 'utf8');
};

AppForServer.prototype._autoRefresh = function(backend) {
  // already been setup if agents is defined
  if (this.agents) return;
  this.agents = {};
  var app = this;

  // Auto-refresh is implemented on top of ShareDB's messaging layer.
  //
  // However, ShareDB wasn't originally designed to support custom message types, so ShareDB's
  // Agent class will log out "Invalid or unknown message" warnings if it encounters a message
  // it doesn't recognize.
  //
  // A workaround is to register a "receive" middleware, which fires when a ShareDB server
  // receives a message from a client. If the message is Derby-related, the middleware will
  // "exit" the middleware chain early by not calling `next()`. That way, the custom message never
  // gets to the ShareDB Agent and won't result in warnings.
  //
  // However, multiple Derby apps can run together on the same ShareDB backend, each adding a
  // "receive" middleware, and they all need to be notified of incoming Derby messages. This
  // solution combines the exit-early approach with a custom event to accomplish that.
  backend.use('receive', function(request, next) {
    var data = request.data;
    if (data.derby) {
      // Derby-related message, emit custom event and "exit" middleware chain early.
      backend.emit('derby:_messageReceived', request.agent, data.derby, data);
      return;
    } else {
      // Not a Derby-related message, pass to next middleware.
      next();
    }
  });

  backend.on('derby:_messageReceived', function(agent, action, message) {
    app._handleMessage(agent, action, message);
  });
};

AppForServer.prototype._handleMessage = function(agent, action, message) {
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

AppForServer.prototype._addAgent = function(agent) {
  this.agents[agent.clientId] = agent;
  var app = this;
  agent.stream.once('end', function() {
    delete app.agents[agent.clientId];
  });
};

AppForServer.prototype._refreshClients = function() {
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

AppForServer.prototype._refreshStyles = function(filename, styles) {
  if (!this.agents) return;
  var message = {
    derby: 'refreshStyles',
    filename: filename,
    css: styles.css
  };
  for (var id in this.agents) {
    this.agents[id].send(message);
  }
};

AppForServer.prototype.middleware = function(backend) {
  return [backend.modelMiddware(), this.router()];
}

AppForServer.prototype.initAutoRefresh = function(backend) {
  this._autoRefresh(backend);
}
