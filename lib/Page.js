var expressions = require('./expressions');

module.exports = Page;

function Page(app, model) {
  this.app = app;
  this.model = model || new app.derby.Model();
  var contextMeta = new expressions.ContextMeta({});
  this.context = new expressions.Context(contextMeta, this.model);
}
Page.prototype.get = function(name) {
  var view = this.app.views.find(name);
  return view.get(this.context);
};
Page.prototype.getFragment = function(name) {
  var view = this.app.views.find(name);
  return view.getFragment(this.context);
};
