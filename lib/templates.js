var saddle = require('saddle');

module.exports = {
  ViewPointer: ViewPointer
, DynamicViewPointer: DynamicViewPointer
, ViewAttributes: ViewAttributes
};

function ViewPointer(name, attributes) {
  this.name = name;
  this.attributes = attributes;
  this.view = null;
}
ViewPointer.prototype = new saddle.Template();
ViewPointer.prototype.get = function(context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at, this.attributes);
  return view.getTemplate().get(viewContext);
};
ViewPointer.prototype.getFragment = function(context, binding) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at, this.attributes);
  return view.getTemplate().appendTo(viewContext, binding);
};
ViewPointer.prototype.appendTo = function(parent, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at, this.attributes);
  view.getTemplate().appendTo(parent, viewContext);
};
ViewPointer.prototype._find = function(context) {
  return this.view ||
    (this.view = context.meta.views.find(this.name, context.at));
};

function DynamicViewPointer(nameExpression, attributes) {
  this.nameExpression = nameExpression;
  this.attributes = attributes;
}
DynamicViewPointer.prototype = new ViewPointer();
DynamicViewPointer.prototype._find = function(context) {
  var name = this.nameExpression.get(context);
  return context.meta.views.find(name, context.at);
};

function ViewAttributes() {}
