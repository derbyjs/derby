var EventEmitter = require('events').EventEmitter;
var tracks = require('tracks');
var util = require('racer/lib/util');
var Views = require('./Views');
var Page = require('./Page');

module.exports = App;

function App(derby, appModule) {
  EventEmitter.call(this);

  // Used in async methods to emit an error event if a callback is not supplied.
  // This will throw if there is no handler for app.on('error')
  var app = this;
  this._defaultCallback = defaultCallback;
  function defaultCallback(err) {
    if (err) app.emit('error', err);
  }

  this.derby = derby;
  this.module = appModule;
  this.views = new Views();
  this.routes = tracks.setup(this);
  if (appModule) appModule.exports = this;
  this._init();
}

util.mergeInto(App.prototype, EventEmitter.prototype);

App.prototype._init = function() {};

App.prototype.use = util.use;

App.prototype.createPage = function() {
  return new Page(this);
};

util.serverRequire(__dirname + '/App.server');
