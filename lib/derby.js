var EventEmitter = require('events').EventEmitter;
var Racer = require('racer/lib/Racer');
var util = require('racer/lib/util');
var App = require('./App');

module.exports = Derby;

function Derby() {}
Derby.prototype = new Racer();

Derby.prototype.createApp = function(appModule) {
  return new App(this, appModule);
};

util.serverRequire(__dirname + '/Derby.server');
