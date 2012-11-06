// This module is implemented using the [racer's plugin pattern](../racer/plugin.html).
// It extends the derby object with methods for creating and initializing an
// application in a browser environment.
//
// Also it exposes a *derby object* to the global scope under the `window.DERBY`
// property.
//
var EventEmitter = require('events').EventEmitter
  , racer = require('racer')
  , merge = racer.util.merge
  , tracks = require('tracks')
  , derbyModel = require('./derby.Model')
  , Dom = require('./Dom')
  , View = require('./View')
  , autoRefresh = require('./refresh').autoRefresh;

module.exports = derbyBrowser;

// It is assumed that only a single instance of this module can run at a time,
// which is reasonable in the browser. So cornerstone application objects are
// stored in a propected properties (as defined by Crokford) in this module.
var derby, view, model, page;

function derbyBrowser(_derby) {
  /* This is written like this so that the DERBY global can be used to
     initialize templates and data.
  */
  window.DERBY = derby = _derby;
  derby.createApp = createApp;
  derby.init = init;
}
derbyBrowser.decorate = 'derby';
derbyBrowser.useWith = {server: false, browser: true};

// ## Creating application object
//
// For example see `./lib/app` module in a newly created application.
//
//     var app = require('derby').createApp(module)
//
// Internals of `createApp(appModule)` in *Derby's browser plugin*:
//
// *   merges in EventEmitter's prototype to app's module exports, thus making
//     the *application object* an event emitter/listener;
// *   creates *view object* passing in libraries array from *component plugin*
//     and *application object* to View constructor; view object is stored into
//     derby.view, application.view and to protected property.
// *   setups tracks by calling `tracks.setup(app, createPageFn, onRouteFn)`;
// *   sets view.history to application.history;
// *   defines application.ready(fn) function, where fn will be called upon
//     application object with model as a parameter on racer's ready event.
//
// ### Page
//
// This object's prototype is defined differently for server and browser.
//
// On browser it is reduced to empty constructor. Resulting Page object has
// render(ns, ctx) method which is a proxy to view.render(model, ns, ctx). So
// essentially Page object bounds model to view object.
//
// #### page.render(ns, ctx)
//
// This method will use the model data as well as an optional context object
// for rendering.
function createApp(appModule) {
  var appExports = merge(appModule.exports, EventEmitter.prototype);

  this.view = appExports.view = view = new View(this._libraries, appExports);

  function Page() {}
  Page.prototype.render = function(ns, ctx) {
    view.render(model, ns, ctx);
  };

  function createPage() {
    return page = new Page();
  }
  function onRoute(callback, page, params, next, isTransitional) {
    view._beforeRoute();
    if (isTransitional) {
      callback(model, params, next);
    } else {
      callback(page, model, params, next);
    }
  }
  tracks.setup(appExports, createPage, onRoute);
  view.history = appExports.history;
  for (var i = this._libraries.length; i--;) {
    this._libraries[i].view.history = appExports.history;
  }

  appExports.ready = function(fn) {
    racer.on('ready', function(model) {
      fn.call(appExports, model);
    });
  };
  return appExports;
}

// ## Initializing Derby application
//
// `init` is called from a script at the bottom of a page, see point #13 in the
// [Pre-defined templates section](http://derbyjs.com/#predefined_templates).
// To see how that script is generated look at `View.prototype._renderScripts`
// function defined in [`View.server`](View.server.html) module.
//
// ### Parameters
//
// 1. *modelBundle* is an array.
// 2. *appHash* is a string containing hash of a generated JavaScript application file.
// 3. *debug* is an integer, e.g. `1`.
// 4. *ns* can be an empty string.
// 5. *ctx* can be an empty object.
//
// Method's internals:
//
// * listens for racer's init and ready events;
// * calls racer.init(modelBundle).
//
function init(modelBundle, appHash, debug, ns, ctx, renderHash) {
  tracks.set('debug', debug);

  /* The init event is fired after the model data is initialized but
   * before the socket object is set
   */
  racer.on('init', function(_model) {
    model = derby.model = view.model = page.model = _model;
    var dom = view.dom = new Dom(model);

    /* Update events should wait until after all ready callbacks have been run */
    dom._preventUpdates = true;

    derbyModel.init(model, dom, view);

    try {
      // Render immediately upon initialization so that the page is in
      // the same state it was when rendered on the server
      view.render(model, ns, ctx, renderHash);
    } catch (err) {
      /*
        Catch errors thrown when rendering and then throw from a setTimeout.
        This way, the remaining init code can run and the app still connects
      */
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
    if (debug) autoRefresh(view, model);
    // TODO: There is probably a better way of doing this than a setTimeout.
    // Delaying here to make sure that all ready callbacks are called before
    // the create functions run on various components
    setTimeout(function() {
      view._afterRender(ns, ctx);
    }, 0);
  });
  racer.init(modelBundle);
}
