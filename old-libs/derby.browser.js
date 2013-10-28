var racer = require('racer')
  , tracks = require('tracks')
  , sharedCreateApp = require('./app').create
  , derbyModel = require('./derby.Model')
  , Dom = require('./Dom')
  , viewModel = require('./viewModel')
  , refresh = require('./refresh')

module.exports = derbyBrowser;

function derbyBrowser(derby) {
  // This assumes that only a single instance of this module can run at a time,
  // which is reasonable in the browser. This is written like this so that
  // the DERBY global can be used to initialize templates and data.
  global.DERBY = derby;
  derby.createApp = createApp;
  derby.init = init;
}

function createApp(appModule) {
  if (derbyBrowser.created) {
    throw new Error('derby.createApp() called multiple times in the browser');
  } else {
    derbyBrowser.created = true;
  }

  var app = sharedCreateApp(this, appModule)
  global.DERBY.app = app;

  racer.once('model', function(model) {
    app.emit('model', model);
  });

  // Adds get, post, put, del, enter, and exit methods
  // as well as history to app
  tracks.setup(app, createPage, onRoute);

  onRenderError = function(err, url) {
    setTimeout(function() {
      window.location = url;
    }, 0);
    throw err;
  }

  function Page(app) {
    this.app = app;
    this.model = app.model;
    this.dom = app.dom;
    this.history = app.history;
    this._viewModels = [];
    this._routing = false;
  }
  Page.prototype.render = function(ns, ctx) {
    try {
      if (typeof ns === 'object') {
        ctx = ns;
        ns = '';
      }
      ctx || (ctx = {});
      ctx.$url = this.params.url;
      app.view.render(this.model, ns, ctx);
      this._routing = false;
      tracks.render(this, {
        url: this.params.url
      , previous: this.params.previous
      , method: 'enter'
      , noNavigate: true
      });
    } catch (err) {
      onRenderError(err, this.params.url);
    }
  };
  Page.prototype.init = viewModel.pageInit;

  function createPage() {
    return new Page(app);
  }
  function onRoute(callback, page, params, next, isTransitional, done) {
    if (!app._initialized) return;
    try {
      if (isTransitional) {
        if (callback.length === 4) {
          callback(page.model, params, next, done);
          return true;
        } else {
          callback(page.model, params, next);
          return;
        }
      }

      if (params.method === 'enter' || params.method === 'exit') {
        callback.call(app, page.model, params);
        next();
        return;
      }

      if (!page._routing) {
        tracks.render(page, {
          url: page.params.previous
        , method: 'exit'
        , noNavigate: true
        });
        app.view._beforeRoute();
      }
      page._routing = true;
      callback(page, page.model, params, next);
    } catch (err) {
      onRenderError(err, page.params.url);
    }
  }

  app.ready = function(fn) {
    if (app._initialized) return fn.call(app.page, app.model);
    app.once('ready', function() {
      fn.call(app.page, app.model);
    });
  };
  return app;
}

function init(modelBundle, ctx) {
  var app = global.DERBY.app
    , ns = ctx.$ns
    , renderHash = ctx.$renderHash
    , derby = this

  // The ready event is fired after the model data is initialized
  racer.ready(function(model) {
    var dom = new Dom(model);

    app.model = model;
    app.dom = dom;

    // Calling history.page() creates the initial page, which is only
    // created one time on the client
    // TODO: This is a rather obtuse mechanism
    var page = app.history.page();
    app.page = page;
    page.model = model;
    page.dom = dom;

    // Reinitialize any viewModels which were already initialized
    // during rendering on the server
    if (ctx.$viewModels) {
      for (var i = 0; i < ctx.$viewModels.length; i++) {
        var item = ctx.$viewModels[i];
        var viewModel = app._viewModels[item[0]];
        item[1].unshift(page);
        viewModel.init.apply(viewModel, item[1]);
      }
    }

    derbyModel.init(derby, app);
    // Catch errors thrown when rendering and then throw from a setTimeout.
    // This way, the remaining init code can run and the app still connects
    try {
      // Render immediately upon initialization so that the page is in
      // EXACTLY the same state it was when rendered on the server
      app.view.render(model, ns, ctx, renderHash);
    } catch (err) {
      setTimeout(function() {
        throw err;
      }, 0);
    }
    app._initialized = true;

    app.emit('ready');

    tracks.render(app.history.page(), {
      url: window.location.pathname + window.location.search
    , method: 'enter'
    , noNavigate: true
    });

    // Delaying here to make sure that all ready callbacks are called before
    // the create functions run on various components
    setTimeout(function() {
      app.view._afterRender(ns, ctx);
    }, 0);

    if (ctx.$scriptPath) {
      model.channel.send('derby:app', ctx.$scriptPath);
      refresh.autoRefresh(app.view, model);
    }
  });
  racer.init(modelBundle);
}
