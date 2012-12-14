var EventEmitter = require('events').EventEmitter
  , racer = require('racer')
  , View = require('./View')

exports.create = createApp;

function createApp(derby, appModule) {
  var app = racer.util.merge(appModule.exports, EventEmitter.prototype)

  app.view = new View(derby._libraries, app);
  app.add = appAdd;

  function appAdd(methods) {
    var key
    for (key in methods) {
      app[key] = methods[key];
    }
    return app;
  }

  return app;
}
