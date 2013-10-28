/*
 * Derby.js
 * Meant to be the entry point when Derby is used
 * from the server and the cleint.
 *
 */

var EventEmitter = require('events').EventEmitter;
var racer = require('racer');
var App = require('./App');

module.exports = Derby;

function Derby() {}
Derby.prototype = racer;

Derby.prototype.createApp = function(appModule) {
  return new App(this, appModule);
};

racer.util.serverRequire(__dirname + '/Derby.server');
