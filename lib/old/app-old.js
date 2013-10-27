var EventEmitter = require('events').EventEmitter;
var racer = require('racer');
var component = require('./component');
var View = require('./View');
var viewModel = require('./viewModel');
var isServer = racer.util.isServer;
var paths = require('./paths');

exports.create = createApp;

function createApp(derby, appModule) {
  var app = racer.util.mergeInto(appModule.exports, EventEmitter.prototype)

  app.use = racer.util.use;
  component(app);
  app.filename = appModule.filename;
  app.view = new View(app._libraries, app, appModule.filename);
  app.fn = appFn;

  function appFn(value, fn) {
    if (typeof value === 'string') {
      // Don't bind the function on the server, since each
      // render gets passed a new model as part of the app
      paths.pathMerge(app, value, fn, bindPage);
    } else {
      paths.treeMerge(app, value, bindPage);
    }
    return app;
  }

  if (!isServer) {
    var bindPage = function(fn) {
      return function() {
        return fn.apply(app.page, arguments);
      };
    };
  }

  app._viewModels = {};
  app.viewModel = viewModel.construct.bind(app);

  return app;
}
