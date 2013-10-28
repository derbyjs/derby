/*
 * App.js
 *
 * Provides the glue between views, controlers and 
 * routes for an application's functionality. App.js
 * is also responsible for creating pages.
 *
 */

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

App.prototype.fn = function() {
  var path, fn;
  if (arguments.length === 1) {
    fn = arguments[0];
  } else {
    path = arguments[0];
    fn = arguments[1];
  }
  var segments = (path && path.split('.')) || [];

  if (typeof fn === 'object') {
    var root = traverseAndCreate(this, segments);
    for (var key in fn) {
      root[key] = fn[key];
    }
    return;
  }

  var lastSegment = segments.pop();
  var node = traverseAndCreate(this, segments);
  node[lastSegment] = fn;
};

function traverseAndCreate(node, segments) {
  if (!segments.length) return node;
  for (var i = 0, len = segments.length; i < len; i++) {
    var segment = segments[i];
    node = node[segment] || (node[segment] = {});
  }
  return node;
}

util.serverRequire(__dirname + '/App.server');
