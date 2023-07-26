var EventEmitter = require('events').EventEmitter;
var Model = require('racer/lib/Model/ModelStandalone');
var util = require('racer/lib/util');
var App = require('./App');
var Page = require('./Page');
var components = require('./components');

module.exports = DerbyStandalone;

require('./documentListeners').add(document);

// Standard Derby inherits from Racer, but we only set up the event emitter and
// expose the Model and util here instead
function DerbyStandalone() {
  EventEmitter.call(this);
}
util.mergeInto(DerbyStandalone.prototype, EventEmitter.prototype);
DerbyStandalone.prototype.Model = Model;
DerbyStandalone.prototype.util = util;

DerbyStandalone.prototype.App = AppStandalone;
DerbyStandalone.prototype.Page = Page;
DerbyStandalone.prototype.Component = components.Component;

DerbyStandalone.prototype.createApp = function() {
  return new this.App(this);
};

function AppStandalone(derby) {
  App.call(this, derby);
}
AppStandalone.prototype = Object.create(App.prototype);
AppStandalone.prototype.constructor = AppStandalone;

AppStandalone.prototype._init = function() {
  this.model = new this.derby.Model();
  this.createPage();
};
