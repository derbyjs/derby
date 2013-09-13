var saddle = require('saddle');

module.exports = {
  View: View
, ViewPointer: ViewPointer
, DynamicViewPointer: DynamicViewPointer
, ViewAttributes: ViewAttributes
};

function ViewFlagMap(source) {
  if (!source) return;
  var flags = source.split(/\s+/);
  for (var i = 0, len = flags.length; i < len; i++) {
    this[flags[i]] = true;
  }
}
function View(views, name, source, options) {
  this.views = views;
  this.name = name;
  this.source = source;
  var nameSegments = this.name.split(':');
  this.at = nameSegments.slice(0, nameSegments.length - 1);
  this.attributesMap = options && new ViewFlagMap(options.attributes);
  this.arraysMap = options && new ViewFlagMap(options.arrays);
  this.template = null;
}
View.prototype = new saddle.Template();
View.prototype.get = function(context) {
  return (this.template || this._parse()).get(context);
};
View.prototype.getFragment = function(context, binding) {
  return (this.template || this._parse()).getFragment(context, binding);
};
View.prototype.appendTo = function(parent, context) {
  (this.template || this._parse()).appendTo(parent, context);
};
// View.prototype._parse is defined in parsing.js, so that it doesn't have to
// be included in the client if templates are all parsed server-side
View.prototype._parse = function() {
  throw new Error('View parsing not available');
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
  return view.get(viewContext);
};
ViewPointer.prototype.getFragment = function(context, binding) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at, this.attributes);
  return view.getFragment(viewContext, binding);
};
ViewPointer.prototype.appendTo = function(parent, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view.at, this.attributes);
  view.appendTo(parent, viewContext);
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
