var racer = require('racer')
  , tracks = require('tracks')
  , sharedCreateApp = require('./app').create
  , derbyModel = require('./derby.Model')
  , Dom = require('./Dom')
  , viewModel = require('./viewModel')
  , autoRefresh = require('./refresh').autoRefresh

module.exports = derbyBrowser;

function derbyBrowser(derby) {
  // This assumes that only a single instance of this module can run at a time,
  // which is reasonable in the browser. This is written like this so that
  // the DERBY global can be used to initialize templates and data.
  global.DERBY = derby;
  derby.createApp = createApp;
  derby.init = init;
}
derbyBrowser.decorate = 'derby';
derbyBrowser.useWith = {server: false, browser: true};

function createApp(appModule) {
  if (derbyBrowser.created) {
    throw new Error('derby.createApp() called multiple times in the browser');
  } else {
    derbyBrowser.created = true;
  }

  var app = sharedCreateApp(this, appModule)
  global.DERBY.app = app;

  // Adds get, post, put, del, enter, and exit methods
  // as well as history to app
  tracks.setup(app, createPage, onRoute);
  console.log('TRACKS SETUP')

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
        app.view._beforeRoute();
        tracks.render(page, {
          url: page.params.previous
        , method: 'exit'
        , noNavigate: true
        });
      }
      page._routing = true;
      callback(page, page.model, params, next);
    } catch (err) {
      onRenderError(err, page.params.url);
    }
  }

  app.ready = function(fn) {
    racer.ready(function(model) {
      fn.call(app, model);
    });
  };
  return app;
}

function init(modelBundle, ctx) {
  var app = global.DERBY.app
    , ns = ctx.$ns
    , appHash = ctx.$appHash
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

    // Reinitialize any viewModels which were already initialized
    // during rendering on the server
    if (ctx.$viewModels) {
      var ViewModels = ctx.$viewModels.map(function(name) {
        return app._ViewModels[name];
      });
      page.init.apply(page, ViewModels);
    }

    // Update events should wait until after first render is done
    dom._preventUpdates = true;

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

    // model.socket.on('connect', function() {
    //   model.socket.emit('derbyClient', appHash, function(reload) {
    //     if (reload) {
    //       var retries = 0
    //         , reloadOnEmpty = function() {
    //             // TODO: Don't hack the Racer internal API so much
    //             if (model._txnQueue.length && retries++ < 20) {
    //               // Clear out private path transactions that could get stuck
    //               model._specModel();
    //               return setTimeout(reloadOnEmpty, 100);
    //             }
    //             window.location.reload(true);
    //           }
    //       reloadOnEmpty();
    //     }
    //   });
    // });
    // var debug = !model.flags.isProduction;
    // if (debug) autoRefresh(app.view, model);

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
  });
  racer.init(modelBundle);
}
