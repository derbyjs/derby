var fs = require('fs')
  , path = require('path')
  , http = require('http')
  , racer = require('racer')
  , tracks = require('tracks')
  , View = require('./View.server')
  , sharedCreateApp = require('./app').create
  , autoRefresh = require('./refresh.server').autoRefresh
  , derbyCluster = require('./cluster')
  , viewModel = require('./viewModel')
  , isProduction = racer.util.isProduction

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

function run(server, port, cb) {
  if (port == null) port = process.env.PORT || (isProduction ? 80 : 3000);
  function listenCallback(err) {
    console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
    cb && cb(err);
  }
  function createServer() {
    if (typeof server === 'string') server = require(server);
    if (typeof server === 'function') server = http.createServer(server);
    server.listen(port, listenCallback);
  }
  if (isProduction) return createServer();
  derbyCluster.run(createServer);
}

function createApp(appModule) {
  var app = sharedCreateApp(this, appModule);
  var view = app.view;
  var relativePath = path
    .relative(__dirname, app.filename)
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/\//g, '-');
  view._scriptPath = '/derby/' + encodeURIComponent(relativePath);

  // Expose methods on the application module

  function Page(model, res) {
    this.model = model;
    this.view = view;
    this._res = res;
    this._viewModels = [];
  }
  Page.prototype.render = function(ns, ctx, status) {
    this._res._derbyViewModels = this._viewModels;
    view.render(this._res, this.model, ns, ctx, status);
  };
  Page.prototype.init = viewModel.pageInit;

  function createPage(req, res) {
    var model = req.getModel();
    app.emit('model', model);
    return new Page(model, res);
  }
  function onRoute(callback, page, params, next, isTransitional, done) {
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
  }
  app.routes = tracks.setup(app, createPage, onRoute);

  app.ready = function() {};
  app.render = function(res, model, ns, ctx, status) {
    return view.render(res, model, ns, ctx, status);
  };

  app.scripts = scripts;

  // Render immediately upon creating the app so that files
  // will be cached for the first render and the appHash gets
  // computed for reconnecting windows
  // process.nextTick(function() {
  //   view.render();
  // });
  return app;
}

function createStatic(root) {
  return new Static(root, this._libraries);
}

function Static(root, libraries) {
  this.root = root;
  this.libraries = libraries;
  this.views = {};
  this.fns = {};
}
Static.prototype.render = function(name, res, model, ns, ctx, status) {
  var view = this.views[name];
  if (!view) {
    view = this.views[name] = new View(this.libraries);
    view._root = this.root;
    view._clientName = name;
    for (var key in this.fns) {
      view.fn(key, this.fns[key]);
    }
  }
  view.render(res, model, ns, ctx, status, true);
};
Static.prototype.fn = function(name, value) {
  this.fns[name] = value;
};

function scripts(store) {
  this.store = store;
  var view = this.view;

  if (!isProduction) autoRefresh(store, view);

  process.nextTick(function() {
    view._loadBundle(function(err) {
      if (err) console.error(err.stack || err);
    });
  });

  store.on('bundle', function(browserify) {
    browserify.require(__dirname + '/derby', {expose: 'derby'});
  });
  function scriptsMiddleware(req, res, next) {
    if (req.url !== view._scriptPath) return next();
    view._loadBundle(function(err, bundle) {
      if (err) return next(err);
      res.type('js');
      res.send(bundle);
    });
  }
  return scriptsMiddleware;
};
