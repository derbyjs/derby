var Model = require('racer').Model;
var App = require('../lib/App');
require('../parsing');

function HarnessApp() {
  App.call(this);
}
HarnessApp.prototype = Object.create(App.prototype);
// Disable App.prototype._init(), which does setup for loading views
// from files on the server and loading serialized views and data
// on the client
HarnessApp.prototype._init = function() {};

module.exports = ComponentHarness;
function ComponentHarness() {
  this.app = new HarnessApp();
  this.model = new Model();
  if (arguments.length > 0) {
    this.setup.apply(this, arguments);
  }
}
ComponentHarness.prototype.setup = function(source) {
  this.app.views.register('$harness', source);
  // Remaining variable arguments are components
  for (var i = 1; i < arguments.length; i++) {
    var constructor = arguments[i];
    this.app.component(constructor);
  }
  return this;
};
ComponentHarness.prototype.getInstance = function() {
  var page = this._createPage();
  page.get('$harness');
  return page._components._1;
};
ComponentHarness.prototype.getHtml = function() {
  var page = this._createPage();
  return page.get('$harness');
};
ComponentHarness.prototype.getFragment = function() {
  var page = this._createPage();
  return page.getFragment('$harness');
};
ComponentHarness.prototype._createPage = function() {
  return new this.app.Page(this.app, this.model);
};
