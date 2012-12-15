var racer = require('racer')
  , tracks = require('tracks')
  , sharedCreateApp = require('./app').create
  , derbyModel = require('./derby.Model')
  , Dom = require('./Dom')
  , autoRefresh = require('./refresh').autoRefresh;

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
  var app = sharedCreateApp(this, appModule)
    , view = app.view

  global.DERBY.app = app;
  app.view = view;

  // Adds get, post, put, del, enter, and exit methods
  // as well as history to app
  tracks.setup(app, createPage, onRoute);

  function Page(model) {
    this.model = model;
    this._routing = false;
  }
  Page.prototype.render = function(ns, ctx) {
    view.render(this.model, ns, ctx);
    this._routing = false;
    tracks.render(this, {
      url: page.params.url
    , previous: page.params.previous
    , method: 'enter'
    , noNavigate: true
    });
  };

  function createPage() {
    return page = new Page(app.model);
  }
  function onRoute(callback, page, params, next, isTransitional) {
    if (isTransitional) {
      callback(page.model, params, next);
      return;
    }

    if (params.method === 'enter' || params.method === 'exit') {
      callback.call(app, page.model, params);
      return;
    }

    if (!page._routing) {
      view._beforeRoute();
      tracks.render(page, {
        url: page.params.url,
        previous: page.params.previous
      , method: 'exit'
      , noNavigate: true
      });
    }
    page._routing = true;
    callback(page, page.model, params, next);
  }

  app.ready = function(fn) {
    racer.on('ready', function(model) {
      fn.call(app, model);
    });
  };
  return app;
}

function init(modelBundle, appHash, debug, ns, ctx, renderHash) {
  var app = global.DERBY.app
    , view = app.view

  tracks.set('debug', debug);

  // The init event is fired after the model data is initialized but
  // before the socket object is set
  racer.on('init', function(model) {
    var dom = new Dom(model);

    app.model = model;
    app.dom = dom;

    // Update events should wait until after first render is done
    dom._preventUpdates = true;

    derbyModel.init(model, dom, app.history);
    // Catch errors thrown when rendering and then throw from a setTimeout.
    // This way, the remaining init code can run and the app still connects
    try {
      // Render immediately upon initialization so that the page is in
      // EXACTLY the same state it was when rendered on the server
      view.render(model, ns, ctx, renderHash);
    } catch (err) {
      setTimeout(function() {
        throw err;
      }, 0);
    }
  });

  // The ready event is fired after the model data is initialized and
  // the socket object is set  
  racer.on('ready', function(model) {
    model.socket.on('connect', function() {
      model.socket.emit('derbyClient', appHash, function(reload) {
        if (reload) {
          var retries = 0
            , reloadOnEmpty = function() {
                // TODO: Don't hack the Racer internal API so much
                if (model._txnQueue.length && retries++ < 20) {
                  // Clear out private path transactions that could get stuck
                  model._specModel();
                  return setTimeout(reloadOnEmpty, 100);
                }
                window.location.reload(true);
              }
          reloadOnEmpty();
        }
      });
    });
    if (debug) autoRefresh(app.view, model);

    tracks.render(app.history.page(), {
      url: window.location.pathname + window.location.search
    , method: 'enter'
    , noNavigate: true
    });

    // Delaying here to make sure that all ready callbacks are called before
    // the create functions run on various components
    setTimeout(function() {
      view._afterRender(ns, ctx);
    }, 0);
  });
  racer.init(modelBundle);
}
