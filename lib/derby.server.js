var fs = require('fs')
  , path = require('path')
  , http = require('http')
  , racer = require('racer')
  , tracks = require('tracks')
  , up = require('up')
  , View = require('./View.server')
  , sharedCreateApp = require('./app').create
  , autoRefresh = require('./refresh.server').autoRefresh
  , util = racer.util
  , merge = util.merge
  , isProduction = util.isProduction
  , proto;

module.exports = derbyServer;

function derbyServer(derby) {
  derby.run = run;
  derby.createApp = createApp;
  derby.createStatic = createStatic;

  Object.defineProperty(derby, 'version', {
    get: function() {
      return require('../package.json').version;
    }
  });
}
derbyServer.decorate = 'derby';
derbyServer.useWith = {server: true, browser: false};

function run(file, port, options) {
  var master, onMessage, server, upService;

  // Resolve relative filenames
  file = path.resolve(file);
  if (port == null) port = process.env.PORT || (isProduction ? 80 : 3000);
  if (options == null) options = {numWorkers: 1};

  try {
    server = require(file);
  } catch (e) {
    console.error('Error requiring server module from `%s`', file);
    throw e;
  }
  if (!(server instanceof http.Server)) {
    throw new Error('`' + file + '` does not export a valid `http.Server`');
  }
  if (!isProduction) {
    // TODO: This extends the internal API of Up. It would be better
    // if Up supported workers being able to force a global reload
    onMessage = up.Worker.prototype.onMessage;
    up.Worker.prototype.onMessage = function(message) {
      if (message.type === 'reload') {
        return upService.reload();
      }
      onMessage.call(this, message);
    };
  }
  master = http.createServer().listen(port);
  upService = up(master, file, options);
  process.on('SIGUSR2', function() {
    console.log('SIGUSR2 signal detected - reloading');
    upService.reload();
  });
  console.log('Starting cluster with %d workers in %s mode',
    options.numWorkers, process.env.NODE_ENV);
  console.log('`kill -s SIGUSR2 %s` to force cluster reload', process.pid);
  console.log('Go to: http://localhost:%d/', port);
}

function createApp(appModule) {
  var app = sharedCreateApp(this, appModule)
    , view = app.view

  view._derbySettings = this.settings;
  view._appFilename = appModule.filename;

  racer.on('createStore', function(store) {
    autoRefresh(store, this.settings, view, isProduction);
  });

  // Expose methods on the application module

  function Page(model, res) {
    this.model = model;
    this._res = res;
  }
  Page.prototype.render = function(ns, ctx, status) {
    view.render(this._res, this.model, ns, ctx, status);
  };

  function createPage(req, res) {
    var model = req.getModel();
    return new Page(model, res);
  }
  function onRoute(callback, page, params, next, isTransitional) {
    if (isTransitional) {
      callback(page.model, params, next);
    } else {
      callback(page, page.model, params, next);
    }
  }
  app.routes = tracks.setup(app, createPage, onRoute);

  app.ready = function() {};
  app.render = function(res, model, ns, ctx, status) {
    return view.render(res, model, ns, ctx, status);
  };

  // Render immediately upon creating the app so that files
  // will be cached for the first render and the appHash gets
  // computed for reconnecting windows
  process.nextTick(function() {
    view.render();
  });
  return app;
}

function createStatic(root, init_view) {
  return new Static(root, this._libraries, init_view);
}

function Static(root, libraries, init_view) {
  this.root = root;
  this.libraries = libraries;
  this.views = {};
  this.init_view = init_view ;
}
Static.prototype.render = function(name, res, model, ns, ctx, status) {
  var view = this.views[name];
  if (!view) {
    view = this.views[name] = new View(this.libraries);
    view._root = this.root;
    view._clientName = name;
	if (this.init_view)
		this.init_view (view) ;
  }
  view.render(res, model, ns, ctx, status, true);
};
