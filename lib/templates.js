var saddle = require('saddle');

module.exports = {
  View: View
, ViewPointer: ViewPointer
, DynamicViewPointer: DynamicViewPointer
, ViewAttributes: ViewAttributes
, ParentWrapper: ParentWrapper
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
  var nameSegments = (this.name || '').split(':');
  this.at = nameSegments.slice(0, nameSegments.length - 1);
  this.attributesMap = options && new ViewFlagMap(options.attributes);
  this.arraysMap = options && new ViewFlagMap(options.arrays);
  // The empty string is considered true for easier HTML attribute parsing
  this.unminified = options && (options.unminified || options.unminified === '');
  this.template = null;
}
View.prototype = new saddle.Template();
View.prototype.get = function(context, unescaped) {
  return (this.template || this._parse()).get(context, unescaped);
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

function ViewPointer(name, attributes, view) {
  this.name = name;
  this.attributes = attributes;
  this.view = view;
}
ViewPointer.prototype = new saddle.Template();
ViewPointer.prototype.get = function(context, unescaped) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes);
  return view.get(viewContext, unescaped);
};
ViewPointer.prototype.getFragment = function(context, binding) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes);
  return view.getFragment(viewContext, binding);
};
ViewPointer.prototype.appendTo = function(parent, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes);
  view.appendTo(parent, viewContext);
};
ViewPointer.prototype._find = function(context) {
  if (this.view) return this.view;
  var contextView = context.getView();
  var at = contextView && contextView.at;
  this.view = context.meta.views.find(this.name, at);
  return this.view;
};

var emptyTemplate = new saddle.Template([]);

function DynamicViewPointer(nameExpression, attributes) {
  this.nameExpression = nameExpression;
  this.attributes = attributes;
  this.optional = attributes && attributes.optional;
}
DynamicViewPointer.prototype = new ViewPointer();
DynamicViewPointer.prototype._find = function(context) {
  var name = this.nameExpression.get(context);
  var contextView = context.getView();
  var at = contextView && contextView.at;
  var view = context.meta.views.find(name, at);
  if (!view) {
    if (this.optional) return emptyTemplate;
    var message = 'No view found for "' + name + '"';
    if (contextView) message += ' in ' + contextView.name + ':' + contextView.source;
    throw new Error(message);
  }

  return view;
};

function ViewAttributes() {}

function ParentWrapper(template) {
  this.template = template;
}
ParentWrapper.prototype = new saddle.Template();
ParentWrapper.prototype.get = function(context, unescaped) {
  return this.template.get(context.parent, unescaped);
};
ParentWrapper.prototype.getFragment = function(context, binding) {
  return this.template.getFragment(context.parent, binding);
};
ParentWrapper.prototype.appendTo = function(parent, context) {
  this.template.appendTo(parent, context.parent);
};
