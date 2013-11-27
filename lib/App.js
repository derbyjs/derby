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
// TODO:
// var templates = require('derby-templates');
var templates = require('derby-html-parser').templates;
var documentListeners = require('./documentListeners');
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
  this.proto = AppPage.prototype = new Page();
  this.Page = AppPage;

  this.derby = derby;
  this.module = appModule;
  this.views = new templates.Views();
  this.routes = tracks.setup(this);
  this.model = null;
  if (appModule) appModule.exports = this;
  this._init();
}

util.mergeInto(App.prototype, EventEmitter.prototype);

// Overriden on server
App.prototype._init = function() {
  var app = this;
  this.derby.on('model', function(model) {
    app.emit('model', model);
    app.model = model;
  });
  this.derby.on('ready', function(model) {
    var page = app.createPage();
    documentListeners.add(document);
    page.attach();
  });
};

App.prototype.use = util.use;

App.prototype.loadViews = function() {};

App.prototype.loadStyles = function() {};

App.prototype.createPage = function() {
  return new this.Page(this, this.model);
};

util.serverRequire(__dirname + '/App.server');
