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
ComponentHarness.prototype.renderHtml = function() {
  return this._get(function(page) {
    page.html = page.get('$harness');
  });
};
ComponentHarness.prototype.renderDom = function() {
  return this._get(function(page) {
    page.fragment = page.getFragment('$harness');
  });
};
ComponentHarness.prototype._get = function(render) {
  var page = new this.app.Page(this.app, this.model);
  render(page);
  // HACK: Implement getting an instance as a side-effect of rendering. This
  // code relies on the fact that while rendering, components are instantiated,
  // and a reference is kept on page._components. Since we just created the
  // page, we can reliably return the first component.
  //
  // The more standard means for getting a reference to a component controller
  // would be to add a hooks in the view with `as=` or `on-init=`. However, we
  // want the developer to pass this view in, so they can supply whatever
  // harness context they like.
  //
  // This may need to be updated if the internal workings of Derby change.
  page.component = page._components._1;
  return page;
};
