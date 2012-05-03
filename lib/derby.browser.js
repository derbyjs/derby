var racer = require('racer')
  , tracks = require('tracks')
  , derbyModel = require('./derby.Model')
  , Dom = require('./Dom')
  , View = require('./View')
  , autoRefresh = require('./refresh').autoRefresh;

exports.createApp = createApp;

function createApp(appModule) {
  var appExports = appModule.exports
    , view, model;

  appModule.exports = function(modelBundle, appHash, debug, ns, ctx) {
    tracks.set('debug', debug);

    // The init event is fired after the model data is initialized but
    // before the socket object is set
    racer.on('init', function(_model) {
      model = view.model = _model;
      var dom = view.dom = new Dom(model, appExports);
      derbyModel.init(model, dom, view);
      // Ignore errors thrown when rendering; these will also be thrown
      // on the server, and throwing here causes the app not to connect
      try {
        // Render immediately upon initialization so that the page is in
        // the same state it was when rendered on the server
        view.render(model, ns, ctx, true);
      } catch (err) {}
    });

    // The ready event is fired after the model data is initialized and
    // the socket object is set
    if (debug) {
      racer.on('ready', function(model) {
        autoRefresh(view, model, appHash);
      });
    }
    racer.init(modelBundle);
    return appExports;
  };

  // Expose methods on the application module. Note that view must added
  // to both appModule.exports and appExports, since it is used before
  // the initialization function to make templates
  appModule.exports.view = appExports.view = view = new View;

  function createPage() {
    return {
      render: function(ns, ctx) {
        view.render(model, ns, ctx);
      }
    };
  }
  function onRoute(callback, page, params, next, isTransitional) {
    if (isTransitional) {
      callback(model, params, next);
    } else {
      callback(page, model, params, next);
    }
  }
  tracks.setup(appExports, createPage, onRoute);

  appExports.ready = function(fn) {
    racer.on('ready', fn);
  };
  return appExports;
};
