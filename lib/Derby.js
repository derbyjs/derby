/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */
var racer = require('racer');

module.exports = Derby;

function Derby() {}
Derby.prototype = Object.create(racer);
Derby.prototype.constructor = Derby;

Derby.prototype.App = require('./App');
Derby.prototype.Page = require('./Page');
Derby.prototype.Component = require('./components').Component;

Derby.prototype.createApp = function(name, filename, options) {
  return new this.App(this, name, filename, options);
};

if (!racer.util.isServer) {
  require('./documentListeners').add(document);
}
