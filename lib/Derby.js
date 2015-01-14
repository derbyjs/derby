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
Derby.prototype = racer;

Derby.prototype.App = App;
Derby.prototype.Page = Page;
Derby.prototype.Component = components.Component;

Derby.prototype.createApp = function(name, filename) {
  if (typeof name !== 'string' && name.length < 1) throw name;
  return new App(this, name, filename);
};

if (!racer.util.isServer) {
  require('./documentListeners').add(document);
}

racer.util.serverRequire(module, './Derby.server');
