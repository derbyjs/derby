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
var expressions = require('derby-expressions').expressions;
var templates = require('derby-templates');
var documentListeners = require('./documentListeners');
var Page = require('./Page');
var deserializeViews = require('./_views');

module.exports = App;

function App(derby, name, filename) {
  EventEmitter.call(this);

  // Inherit from Page so that we can add controller functions as prototype
  // methods on this app's pages
  function AppPage() {
    Page.apply(this, arguments);
  }
  this.proto = AppPage.prototype = new Page();
  this.Page = AppPage;

  this.derby = derby;
  this.name = name;
  this.filename = filename;
  this.views = new templates.Views();
  this.tracksRoutes = tracks.setup(this);
  this.model = null;
  this._init();
}

util.mergeInto(App.prototype, EventEmitter.prototype);

// Overriden on server
App.prototype._init = function() {
  if (deserializeViews) deserializeViews(templates, expressions, this.views);

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
