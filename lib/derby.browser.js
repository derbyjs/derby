var EventEmitter = require('events').EventEmitter
  , racer = require('racer')
  , merge = racer.util.merge
  , tracks = require('tracks')
  , derbyModel = require('./derby.Model')
  , Dom = require('./Dom')
  , View = require('./View')
  , autoRefresh = require('./refresh').autoRefresh;

module.exports = derbyBrowser;

// This assumes that only a single instance of this module can run at a time,
// which is reasonable in the browser. This is written like this so that
// the DERBY global can be used to initialize templates and data.
var derby, view, model, page;

function derbyBrowser(_derby) {
  window.DERBY = derby = _derby;
  derby.createApp = createApp;
  derby.init = init;
}
derbyBrowser.decorate = 'derby';
derbyBrowser.useWith = {server: false, browser: true};

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
    if (isTransitional) {
      callback(model, params, next);
    } else {
      callback(page, model, params, next);
    }
  }
  tracks.setup(appExports, createPage, onRoute);
  view.history = appExports.history;

  appExports.ready = function(fn) {
    racer.on('ready', function(model) {
      fn.call(appExports, model);
    });
  };
  return appExports;
}

function init(modelBundle, appHash, debug, ns, ctx) {
  tracks.set('debug', debug);

  // The init event is fired after the model data is initialized but
  // before the socket object is set
  racer.on('init', function(_model) {
    model = derby.model = view.model = page.model = _model;
    var dom = view.dom = new Dom(model);

    // Update events should wait until after all ready callbacks have been run
    dom._preventUpdates = true;

    derbyModel.init(model, dom, view);
    // Catch errors thrown when rendering and then throw from a setTimeout.
    // This way, the remaining init code can run and the app still connects
    try {
      // Render immediately upon initialization so that the page is in
      // the same state it was when rendered on the server
      view.render(model, ns, ctx, true);
    } catch (err) {
      setTimeout(function() {
        throw err;
      }, 0);
    }
  });

  // The ready event is fired after the model data is initialized and
  // the socket object is set  
  racer.on('ready', function(model) {
    if (debug) autoRefresh(view, model, appHash);
    view._afterRender(ns, ctx);
  });
  racer.init(modelBundle);
}
