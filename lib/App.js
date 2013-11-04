/*
 * App.js
 *
 * Provides the glue between views, controllers, and routes for an
 * application's functionality. Apps are responsible for creating pages.
 *
 */

var EventEmitter = require('events').EventEmitter;
var tracks = require('tracks');
var util = require('racer').util;
var templates = require('./templates');
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

  // Inherit from Page so that we can add controller functions as prototype
  // methods on this app's pages
  function AppPage() {
    Page.apply(this, arguments);
  }
  AppPage.prototype = new Page();
  this.Page = AppPage;

  this.derby = derby;
  this.module = appModule;
  this.views = new templates.Views();
  this.routes = tracks.setup(this);
  if (appModule) appModule.exports = this;
  this._init();
}

util.mergeInto(App.prototype, EventEmitter.prototype);

App.prototype._init = function() {};

App.prototype.use = util.use;

App.prototype.createPage = function() {
  return new this.Page(this);
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
    var root = traverseAndCreate(this.Page.prototype, segments);
    for (var key in fn) {
      root[key] = fn[key];
    }
    return;
  }

  var lastSegment = segments.pop();
  var node = traverseAndCreate(this.Page.prototype, segments);
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
