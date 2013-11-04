//
// TODO: move out into an new module.
//
//

var EventEmitter = require('events').EventEmitter;
var Model = require('racer/lib/Model/standalone');
var util = require('racer').util;
var App = require('./App');

module.exports = DerbyStandalone;

function DerbyStandalone() {
  EventEmitter.call(this);
}

util.mergeInto(DerbyStandalone.prototype, EventEmitter.prototype);

// Make classes accessible for use by plugins and tests
DerbyStandalone.prototype.Model = Model;
DerbyStandalone.prototype.util = util;

// Support plugins on DerbyStandalone instances
DerbyStandalone.prototype.use = util.use;

DerbyStandalone.prototype.createApp = function() {
  return new App(this);
};
