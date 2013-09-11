var saddle = require('saddle');

module.exports = {
  ViewPointer: ViewPointer
, DynamicViewPointer: DynamicViewPointer
};

function ViewPointer(name, attributesExpression) {
  this.name = name;
  this.attributesExpression = null;
  this.view = null;
}
ViewPointer.prototype = new saddle.Template();
ViewPointer.prototype.get = function(context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at);
  return view.getTemplate().get(viewContext);
};
ViewPointer.prototype.getFragment = function(context, binding) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at);
  return view.getTemplate().appendTo(viewContext, binding);
};
ViewPointer.prototype.appendTo = function(parent, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at);
  view.getTemplate().appendTo(parent, viewContext);
};
ViewPointer.prototype._find = function(context) {
  return this.view ||
    (this.view = context.meta.views.find(this.name, context.at));
};

function DynamicViewPointer(nameExpression, attributesExpression) {
  this.nameExpression = nameExpression;
  this.attributesExpression = attributesExpression;
}
DynamicViewPointer.prototype = new ViewPointer();
DynamicViewPointer.prototype._find = function(context) {
  var name = this.nameExpression.get(context);
  return context.meta.views.find(name, context.at);
};
