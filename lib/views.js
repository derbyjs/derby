var saddle = require('saddle');
var templates = require('./templates');
var expressions = require('./expressions');

module.exports = {
  Views: Views
, createViewPointer: createViewPointer
};

function ViewsMap() {}
function Views() {
  this.map = new ViewsMap();
}
Views.prototype.find = function(name, at) {
  var map = this.map;

  // Exact match lookup
  var match = map[name];
  if (match) return match;

  // Relative lookup
  at || (at = 'app');
  var segments = at.split(':');
  for (var i = segments.length; i; i--) {
    var prefix = segments.slice(0, i).join(':');
    match = map[prefix + ':' + name];
    if (match) return match;
  }
};
Views.prototype.register = function(name, source) {
  this.map[name] = new View(name, source);
};

function View(name, source) {
  this.name = name;
  this.source = source;
  var segments = this.name.split(':');
  this.at = segments.slice(0, segments.length - 1);
  this.template = null;
}
View.prototype.getTemplate = function() {
  return this.template ||
    (this.template = templates.createTemplate(this.source));
}

function createViewPointer(expression) {
  if (expression instanceof expressions.LiteralExpression) {
    var name = expression.get();
    return new ViewPointer(name, null);
  } else {
    return new DynamicViewPointer(expression, null);
  }
}

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
