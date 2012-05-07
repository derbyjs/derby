var fs = require('fs')
  , path = require('path')
  , http = require('http')
  , racer = require('racer')
  , tracks = require('tracks')
  , up = require('up')
  , View = require('./View.server')
  , autoRefresh = require('./refresh.server').autoRefresh
  , util = racer.util
  , isProduction = util.isProduction;

var derby = module.exports = util.mergeAll(Object.create(racer), {
  options: {}

, run: function(file, port, options) {
    var master, onMessage, server, upService;

    // Resolve relative filenames
    file = path.resolve(file);
    if (port == null) port = isProduction ? 80 : 3000;
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

, createApp: function(appModule) {
    var appExports = appModule.exports
      , view = new View
      , options = this.options
      , session, store;

    view._derbyOptions = options;
    view._appFilename = appModule.filename;
    function setStore(_store) {
      autoRefresh(_store, options, view);
      if (session != null) session._setStore(_store);
      store = _store;
    }

    // Expose methods on the application module

    function Page(model, res) {
      this._model = model;
      this._res = res;
    }
    Page.prototype.render = function(ns, ctx, status) {
      view.render(this._res, this._model, ns, ctx, status);
    };

    function createPage(req, res) {
      var model = req.model || store.createModel();
      return new Page(model, res);
    }
    function onRoute(callback, page, params, next, isTransitional) {
      if (isTransitional) {
        callback(page._model, params, next);
      } else {
        callback(page, page._model, params, next);
      }
    }
    appExports.routes = tracks.setup(appExports, createPage, onRoute);

    appExports._setStore = setStore;
    appExports.view = view;
    appExports.ready = function() {};
    appExports.createStore = function(options) {
      return setStore(racer.createStore(options));
    };
    appExports.session = function() {
      return session = racer.session(store);
    };
    appExports.render = function(res, model, ns, ctx, status) {
      return view.render(res, model, ns, ctx, status);
    };

    // Render immediately upon creating the app so that files
    // will be cached for the first render
    process.nextTick(function() {
      view.render();
    });
    return appExports;
  }

, createStatic: function(root) {
    return new Static(root);
  }

, createStore: function() {
    var len = arguments.length
      , last = arguments[len - 1]
      , options, app, store;
    // Last argument may be a createStore options object
    if (!last.view) {
      options = last;
      len--;
    }
    store = racer.createStore(options);
    for (var i = len; i--;) {
      app = args[i];
      app._setStore(store);
    }
    return store;
  }

, use: function(plugin, opts) {
    var decorate = plugin.decorate;
    if (decorate === 'racer') {
      plugin(racer, opts);
    } else if (decorate === 'derby') {
      plugin(derby, opts);
    } else {
      throw new Error('plugin.decorate must be either "racer" or "derby"');
    }
    return this;  // Make chainable
  }
});

Object.defineProperty(derby, 'version', {
  get: function() {
    return require('../package.json').version;
  }
});

function Static(root) {
  this.root = root;
  this.views = {};
}
Static.prototype.render = function(name, res, model, ns, ctx, status) {
  var view = this.views[name];
  if (!view) {
    view = this.views[name] = new View;
    view._root = this.root;
    view._clientName = name;
  }
  view.render(res, model, ns, ctx, status, true);
};
