/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */

var EventEmitter = require('events').EventEmitter;
var racer = require('racer');
var App = require('./App');
var Page = require('./Page');
var components = require('./components');

module.exports = Derby;

function Derby() {}
Derby.prototype = Object.create(racer);
Derby.prototype.constructor = Derby;

Derby.prototype.App = App;
Derby.prototype.Page = Page;
Derby.prototype.Component = components.Component;

Derby.prototype.createApp = function(name, filename, options) {
  return new App(this, name, filename, options);
};

if (!racer.util.isServer) {
  require('./documentListeners').add(document);
}

racer.util.serverRequire(module, './Derby.server');
