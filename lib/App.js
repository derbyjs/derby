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
var derbyTemplates = require('derby-templates');
var documentListeners = require('./documentListeners');
var Page = require('./Page');
var serializedViews = require('./_views');

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
  this.views = new derbyTemplates.templates.Views();
  this.tracksRoutes = tracks.setup(this);
  this.model = null;
  this.page = null;
  this._init();
}

util.mergeInto(App.prototype, EventEmitter.prototype);

// Overriden on server
App.prototype._init = function() {
  if (serializedViews) serializedViews(derbyTemplates, this.views);

  var app = this;
  this.derby.on('model', function(model) {
    app.emit('model', model);
    app.model = model;
    app._autoRefresh();
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
  if (this.page) this.page.destroy();
  var page = new this.Page(this, this.model);
  this.page = page;
  return page;
};

App.prototype.onRoute = function(callback, page, params, next, isTransitional, done) {
  if (isTransitional) {
    if (callback.length === 4) {
      callback(page.model, params, next, done);
      return true;
    } else {
      callback(page.model, params, next);
      return;
    }
  }
  callback(page, page.model, params, next);
};

App.prototype._autoRefresh = function() {
  var app = this;
  this.model.on('change', '$connection.state', function(state) {
    if (state !== 'connected') return;
    var data = {name: app.name, hash: global.DERBY_SCRIPT_HASH};
    app.model.channel.send('derby:app', data, function(err) {
      if (!err) return;
      // Reload in a timeout so that returning fetches have time to complete
      // in case an onbeforeunload handler is being used
      setTimeout(function() {
        window.location = window.location;
      }, 100);
    });
  });
  this.model.channel.on('derby:refreshViews', function(serializedViews) {
    var fn = new Function('return ' + serializedViews)();
    fn(derbyTemplates, app.views);
    var ns = app.model.get('$render.ns');
    app.page.render(ns);
  });
};

util.serverRequire(__dirname + '/App.server');
