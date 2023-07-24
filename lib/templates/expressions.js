var serializeObject = require('serialize-object');
var operatorFns = require('./operatorFns');
var templates = require('./templates');
var Template = templates.Template;
var util = require('./util');
var concat = util.concat;

exports.lookup = lookup;
exports.templateTruthy = templateTruthy;
exports.pathSegments = pathSegments;
exports.renderValue = renderValue;
exports.renderTemplate = renderTemplate;
exports.ExpressionMeta = ExpressionMeta;

exports.Expression = Expression;
exports.LiteralExpression = LiteralExpression;
exports.PathExpression = PathExpression;
exports.RelativePathExpression = RelativePathExpression;
exports.AliasPathExpression = AliasPathExpression;
exports.AttributePathExpression = AttributePathExpression;
exports.BracketsExpression = BracketsExpression;
exports.DeferRenderExpression = DeferRenderExpression;
exports.ArrayExpression = ArrayExpression;
exports.ObjectExpression = ObjectExpression;
exports.FnExpression = FnExpression;
exports.OperatorExpression = OperatorExpression;
exports.NewExpression = NewExpression;
exports.SequenceExpression = SequenceExpression;
exports.ViewParentExpression = ViewParentExpression;
exports.ScopedModelExpression = ScopedModelExpression;

function lookup(segments, value) {
  if (!segments) return value;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (value == null) return value;
    value = value[segments[i]];
  }
  return value;
}

// Unlike JS, `[]` is falsey. Otherwise, truthiness is the same as JS
function templateTruthy(value) {
  return (Array.isArray(value)) ? value.length > 0 : !!value;
}

function pathSegments(segments) {
  var result = [];
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    result[i] = (typeof segment === 'object') ? segment.item : segment;
  }
  return result;
}

function renderValue(value, context) {
  return (typeof value !== 'object') ? value :
    (value instanceof Template) ? renderTemplate(value, context) :
      (Array.isArray(value)) ? renderArray(value, context) :
        renderObject(value, context);
}
function renderTemplate(value, context) {
  var i = 1000;
  while (value instanceof Template) {
    if (--i < 0) throw new Error('Maximum template render passes exceeded');
    value = value.get(context, true);
  }
  return value;
}
function renderArray(array, context) {
  for (var i = 0; i < array.length; i++) {
    if (hasTemplateProperty(array[i])) {
      return renderArrayProperties(array, context);
    }
  }
  return array;
}
function renderObject(object, context) {
  return (hasTemplateProperty(object)) ?
    renderObjectProperties(object, context) : object;
}
function hasTemplateProperty(object) {
  if (!object) return false;
  if (object.constructor !== Object) return false;
  for (var key in object) {
    if (object[key] instanceof Template) return true;
  }
  return false;
}
function renderArrayProperties(array, context) {
  var out = new Array(array.length);
  for (var i = 0; i < array.length; i++) {
    out[i] = renderValue(array[i], context);
  }
  return out;
}
function renderObjectProperties(object, context) {
  var out = {};
  for (var key in object) {
    out[key] = renderValue(object[key], context);
  }
  return out;
}

function ExpressionMeta(source, blockType, isEnd, as, keyAs, unescaped, bindType, valueType) {
  this.source = source;
  this.blockType = blockType;
  this.isEnd = isEnd;
  this.as = as;
  this.keyAs = keyAs;
  this.unescaped = unescaped;
  this.bindType = bindType;
  this.valueType = valueType;
}
ExpressionMeta.prototype.module = 'expressions';
ExpressionMeta.prototype.type = 'ExpressionMeta';
ExpressionMeta.prototype.serialize = function() {
  return serializeObject.instance(
    this,
    this.source,
    this.blockType,
    this.isEnd,
    this.as,
    this.keyAs,
    this.unescaped,
    this.bindType,
    this.valueType
  );
};

function Expression(meta) {
  this.meta = meta;
}
Expression.prototype.module = 'expressions';
Expression.prototype.type = 'Expression';
Expression.prototype.serialize = function() {
  return serializeObject.instance(this, this.meta);
};
Expression.prototype.toString = function() {
  return this.meta && this.meta.source;
};
Expression.prototype.truthy = function(context) {
  var blockType = this.meta.blockType;
  if (blockType === 'else') return true;
  var value = this.get(context, true);
  var truthy = templateTruthy(value);
  return (blockType === 'unless') ? !truthy : truthy;
};
Expression.prototype.get = function() {};
// Return the expression's segment list with context objects
Expression.prototype.resolve = function() {};
// Return a list of segment lists or null
Expression.prototype.dependencies = function() {};
// Return the pathSegments that the expression currently resolves to or null
Expression.prototype.pathSegments = function(context) {
  var segments = this.resolve(context);
  return segments && pathSegments(segments);
};
Expression.prototype.set = function(context, value) {
  var segments = this.pathSegments(context);
  if (!segments) throw new Error('Expression does not support setting');
  context.controller.model._set(segments, value);
};
Expression.prototype._resolvePatch = function(context, segments) {
  return (context && context.expression === this && context.item != null) ?
    segments.concat(context) : segments;
};
Expression.prototype.isUnbound = function(context) {
  // If the template being rendered has an explicit bindType keyword, such as:
  // {{unbound #item.text}}
  var bindType = this.meta && this.meta.bindType;
  if (bindType === 'unbound') return true;
  if (bindType === 'bound') return false;
  // Otherwise, inherit from the context
  return context.unbound;
};
Expression.prototype._lookupAndContextifyValue = function(value, context) {
  if (this.segments && this.segments.length) {
    // If expression has segments, e.g. `bar.baz` in `#foo.bar.baz`, then
    // render the base value (e.g. `#foo`) if it's a template and look up the
    // value at the indicated path.
    value = renderTemplate(value, context);
    value = lookup(this.segments, value);
  }
  if (value instanceof Template && !(value instanceof templates.ContextClosure)) {
    // If we're not immediately rendering the template, then create a ContextClosure
    // so that the value renders with the correct context later.
    value = new templates.ContextClosure(value, context);
  }
  return value;
};


function LiteralExpression(value, meta) {
  this.value = value;
  this.meta = meta;
}
LiteralExpression.prototype = Object.create(Expression.prototype);
LiteralExpression.prototype.constructor = LiteralExpression;
LiteralExpression.prototype.type = 'LiteralExpression';
LiteralExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.value, this.meta);
};
LiteralExpression.prototype.get = function() {
  return this.value;
};

function PathExpression(segments, meta) {
  this.segments = segments;
  this.meta = meta;
}
PathExpression.prototype = Object.create(Expression.prototype);
PathExpression.prototype.constructor = PathExpression;
PathExpression.prototype.type = 'PathExpression';
PathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.segments, this.meta);
};
PathExpression.prototype.get = function(context) {
  // See View::dependencies. This is needed in order to handle the case of
  // getting dependencies within a component template, in which case we cannot
  // access model data separate from rendering.
  if (!context.controller) return;
  return lookup(this.segments, context.controller.model.data);
};
PathExpression.prototype.resolve = function(context) {
  // See View::dependencies. This is needed in order to handle the case of
  // getting dependencies within a component template, in which case we cannot
  // access model data separate from rendering.
  if (!context.controller) return;
  var segments = concat(context.controller._scope, this.segments);
  return this._resolvePatch(context, segments);
};
PathExpression.prototype.dependencies = function(context, options) {
  // See View::dependencies. This is needed in order to handle the case of
  // getting dependencies within a component template, in which case we cannot
  // access model data separate from rendering.
  if (!context.controller) return;
  var value = lookup(this.segments, context.controller.model.data);
  var dependencies = getDependencies(value, context, options);
  return appendDependency(dependencies, this, context);
};

function RelativePathExpression(segments, meta) {
  this.segments = segments;
  this.meta = meta;
}
RelativePathExpression.prototype = Object.create(Expression.prototype);
RelativePathExpression.prototype.constructor = RelativePathExpression;
RelativePathExpression.prototype.type = 'RelativePathExpression';
RelativePathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.segments, this.meta);
};
RelativePathExpression.prototype.get = function(context) {
  var relativeContext = context.forRelative(this);
  var value = relativeContext.get();
  return this._lookupAndContextifyValue(value, relativeContext);
};
RelativePathExpression.prototype.resolve = function(context) {
  var relativeContext = context.forRelative(this);
  var base = (relativeContext.expression) ?
    relativeContext.expression.resolve(relativeContext) :
    [];
  if (!base) return;
  var segments = base.concat(this.segments);
  return this._resolvePatch(context, segments);
};
RelativePathExpression.prototype.dependencies = function(context, options) {
  // Return inner dependencies from our ancestor
  // (e.g., {{ with foo[bar] }} ... {{ this.x }} has 'bar' as a dependency.)
  var relativeContext = context.forRelative(this);
  var dependencies = relativeContext.expression &&
    relativeContext.expression.dependencies(relativeContext, options);
  return swapLastDependency(dependencies, this, context);
};

function AliasPathExpression(alias, segments, meta) {
  this.alias = alias;
  this.segments = segments;
  this.meta = meta;
}
AliasPathExpression.prototype = Object.create(Expression.prototype);
AliasPathExpression.prototype.constructor = AliasPathExpression;
AliasPathExpression.prototype.type = 'AliasPathExpression';
AliasPathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.alias, this.segments, this.meta);
};
AliasPathExpression.prototype.get = function(context) {
  var aliasContext = context.forAlias(this.alias);
  if (!aliasContext) return;
  if (aliasContext.keyAlias === this.alias) {
    return aliasContext.item;
  }
  var value = aliasContext.get();
  return this._lookupAndContextifyValue(value, aliasContext);
};
AliasPathExpression.prototype.resolve = function(context) {
  var aliasContext = context.forAlias(this.alias);
  if (!aliasContext) return;
  if (aliasContext.keyAlias === this.alias) return;
  var base = aliasContext.expression.resolve(aliasContext);
  if (!base) return;
  var segments = base.concat(this.segments);
  return this._resolvePatch(context, segments);
};
AliasPathExpression.prototype.dependencies = function(context, options) {
  var aliasContext = context.forAlias(this.alias);
  if (!aliasContext) return;
  if (aliasContext.keyAlias === this.alias) {
    // For keyAliases, use a dependency of the entire list, so that it will
    // always update when the list itself changes. This is over-binding, but
    // would otherwise be much more complex
    var base = aliasContext.expression.resolve(aliasContext.parent);
    if (!base) return;
    return [base];
  }

  var dependencies = aliasContext.expression.dependencies(aliasContext, options);
  return swapLastDependency(dependencies, this, context);
};

function AttributePathExpression(attribute, segments, meta) {
  this.attribute = attribute;
  this.segments = segments;
  this.meta = meta;
}
AttributePathExpression.prototype = Object.create(Expression.prototype);
AttributePathExpression.prototype.constructor = AttributePathExpression;
AttributePathExpression.prototype.type = 'AttributePathExpression';
AttributePathExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.attribute, this.segments, this.meta);
};
AttributePathExpression.prototype.get = function(context) {
  var attributeContext = context.forAttribute(this.attribute);
  if (!attributeContext) return;
  var value = attributeContext.attributes[this.attribute];
  if (value instanceof Expression) {
    value = value.get(attributeContext);
  }
  return this._lookupAndContextifyValue(value, attributeContext);
};
AttributePathExpression.prototype.resolve = function(context) {
  var attributeContext = context.forAttribute(this.attribute);
  if (!attributeContext) return;
  // Attributes may be a template, an expression, or a literal value
  var base;
  var value = attributeContext.attributes[this.attribute];
  if (value instanceof Expression || value instanceof Template) {
    base = value.resolve(attributeContext);
  }
  if (!base) return;
  var segments = base.concat(this.segments);
  return this._resolvePatch(context, segments);
};
AttributePathExpression.prototype.dependencies = function(context, options) {
  var attributeContext = context.forAttribute(this.attribute);
  if (!attributeContext) return;

  // Attributes may be a template, an expression, or a literal value
  var value = attributeContext.attributes[this.attribute];
  var dependencies = getDependencies(value, attributeContext, options);
  return swapLastDependency(dependencies, this, context);
};

function BracketsExpression(before, inside, afterSegments, meta) {
  this.before = before;
  this.inside = inside;
  this.afterSegments = afterSegments;
  this.meta = meta;
}
BracketsExpression.prototype = Object.create(Expression.prototype);
BracketsExpression.prototype.constructor = BracketsExpression;
BracketsExpression.prototype.type = 'BracketsExpression';
BracketsExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.before, this.inside, this.afterSegments, this.meta);
};
BracketsExpression.prototype.get = function(context) {
  var inside = this.inside.get(context);
  if (inside == null) return;
  var before = this.before.get(context);
  if (!before) return;
  var base = before[inside];
  return (this.afterSegments) ? lookup(this.afterSegments, base) : base;
};
BracketsExpression.prototype.resolve = function(context) {
  // Get and split the current value of the expression inside the brackets
  var inside = this.inside.get(context);
  if (inside == null) return;

  // Concat the before, inside, and optional after segments
  var base = this.before.resolve(context);
  if (!base) return;
  var segments = (this.afterSegments) ?
    base.concat(inside, this.afterSegments) :
    base.concat(inside);
  return this._resolvePatch(context, segments);
};
BracketsExpression.prototype.dependencies = function(context, options) {
  var before = this.before.dependencies(context, options);
  if (before) before.pop();
  var inner = this.inside.dependencies(context, options);
  var dependencies = concat(before, inner);
  return appendDependency(dependencies, this, context);
};

// This Expression is used to wrap a template so that when its containing
// Expression--such as an ObjectExpression or ArrayExpression--is evaluated,
// it returns the template unrendered and wrapped in the current context.
// Separating evaluation of the containing expression from template rendering
// is used to support array attributes of views. This way, we can evaluate an
// array and iterate through it separately from rendering template content
function DeferRenderExpression(template, meta) {
  if (!(template instanceof Template)) {
    throw new Error('DeferRenderExpression requires a Template argument');
  }
  this.template = template;
  this.meta = meta;
}
DeferRenderExpression.prototype = Object.create(Expression.prototype);
DeferRenderExpression.prototype.constructor = DeferRenderExpression;
DeferRenderExpression.prototype.type = 'DeferRenderExpression';
DeferRenderExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.template, this.meta);
};
DeferRenderExpression.prototype.get = function(context) {
  return new templates.ContextClosure(this.template, context);
};

function ArrayExpression(items, afterSegments, meta) {
  this.items = items;
  this.afterSegments = afterSegments;
  this.meta = meta;
}
ArrayExpression.prototype = Object.create(Expression.prototype);
ArrayExpression.prototype.constructor = ArrayExpression;
ArrayExpression.prototype.type = 'ArrayExpression';
ArrayExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.items, this.afterSegments, this.meta);
};
ArrayExpression.prototype.get = function(context) {
  var items = new Array(this.items.length);
  for (var i = 0; i < this.items.length; i++) {
    var value = this.items[i].get(context);
    items[i] = value;
  }
  return (this.afterSegments) ? lookup(this.afterSegments, items) : items;
};
ArrayExpression.prototype.dependencies = function(context, options) {
  if (!this.items) return;
  var dependencies;
  for (var i = 0; i < this.items.length; i++) {
    var itemDependencies = this.items[i].dependencies(context, options);
    dependencies = concat(dependencies, itemDependencies);
  }
  return dependencies;
};

function ObjectExpression(properties, afterSegments, meta) {
  this.properties = properties;
  this.afterSegments = afterSegments;
  this.meta = meta;
}
ObjectExpression.prototype = Object.create(Expression.prototype);
ObjectExpression.prototype.constructor = ObjectExpression;
ObjectExpression.prototype.type = 'ObjectExpression';
ObjectExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.properties, this.afterSegments, this.meta);
};
ObjectExpression.prototype.get = function(context) {
  var object = {};
  for (var key in this.properties) {
    var value = this.properties[key].get(context);
    object[key] = value;
  }
  return (this.afterSegments) ? lookup(this.afterSegments, object) : object;
};
ObjectExpression.prototype.dependencies = function(context, options) {
  if (!this.properties) return;
  var dependencies;
  for (var key in this.properties) {
    var propertyDependencies = this.properties[key].dependencies(context, options);
    dependencies = concat(dependencies, propertyDependencies);
  }
  return dependencies;
};

function FnExpression(segments, args, afterSegments, meta) {
  this.segments = segments;
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = meta;
  var parentSegments = segments && segments.slice();
  this.lastSegment = parentSegments && parentSegments.pop();
  this.parentSegments = (parentSegments && parentSegments.length) ? parentSegments : null;
}
FnExpression.prototype = Object.create(Expression.prototype);
FnExpression.prototype.constructor = FnExpression;
FnExpression.prototype.type = 'FnExpression';
FnExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.segments, this.args, this.afterSegments, this.meta);
};
FnExpression.prototype.get = function(context) {
  var value = this.apply(context);
  // Lookup property underneath computed value if needed
  return (this.afterSegments) ? lookup(this.afterSegments, value) : value;
};
FnExpression.prototype.apply = function(context, extraInputs) {
  // See View::dependencies. This is needed in order to handle the case of
  // getting dependencies within a component template, in which case we cannot
  // access model data separate from rendering.
  if (!context.controller) return;
  var parent = this._lookupParent(context);
  var fn = parent[this.lastSegment];
  var getFn = fn.get || fn;
  var out = this._applyFn(getFn, context, extraInputs, parent);
  return out;
};
FnExpression.prototype._lookupParent = function(context) {
  // Lookup function on current controller
  var controller = context.controller;
  var segments = this.parentSegments;
  var parent = (segments) ? lookup(segments, controller) : controller;
  if (parent && parent[this.lastSegment]) return parent;
  // Otherwise lookup function on page
  var page = controller.page;
  if (controller !== page) {
    parent = (segments) ? lookup(segments, page) : page;
    if (parent && parent[this.lastSegment]) return parent;
  }
  // Otherwise lookup function on global
  parent = (segments) ? lookup(segments, global) : global;
  if (parent && parent[this.lastSegment]) return parent;
  // Throw if not found
  throw new Error('Function not found for: ' + this.segments.join('.'));
};
FnExpression.prototype._getInputs = function(context) {
  var inputs = [];
  for (var i = 0, len = this.args.length; i < len; i++) {
    var value = this.args[i].get(context);
    inputs.push(renderValue(value, context));
  }
  return inputs;
};
FnExpression.prototype._applyFn = function(fn, context, extraInputs, thisArg) {
  // Apply if there are no path inputs
  if (!this.args) {
    return (extraInputs) ?
      fn.apply(thisArg, extraInputs) :
      fn.call(thisArg);
  }
  // Otherwise, get the current value for path inputs and apply
  var inputs = this._getInputs(context);
  if (extraInputs) {
    for (var i = 0, len = extraInputs.length; i < len; i++) {
      inputs.push(extraInputs[i]);
    }
  }
  return fn.apply(thisArg, inputs);
};
FnExpression.prototype.dependencies = function(context, options) {
  var dependencies = [];
  if (!this.args) return dependencies;
  for (var i = 0, len = this.args.length; i < len; i++) {
    var argDependencies = this.args[i].dependencies(context, options);
    if (!argDependencies || argDependencies.length < 1) continue;
    var end = argDependencies.length - 1;
    for (var j = 0; j < end; j++) {
      dependencies.push(argDependencies[j]);
    }
    var last = argDependencies[end];
    if (last[last.length - 1] !== '*') {
      last = last.concat('*');
    }
    dependencies.push(last);
  }
  return dependencies;
};
FnExpression.prototype.set = function(context, value) {
  var controller = context.controller;
  var fn, parent;
  while (controller) {
    parent = (this.parentSegments) ?
      lookup(this.parentSegments, controller) :
      controller;
    fn = parent && parent[this.lastSegment];
    if (fn) break;
    controller = controller.parent;
  }
  var setFn = fn && fn.set;
  if (!setFn) throw new Error('No setter function for: ' + this.segments.join('.'));
  var inputs = this._getInputs(context);
  inputs.unshift(value);
  var out = setFn.apply(parent, inputs);
  for (var i in out) {
    this.args[i].set(context, out[i]);
  }
};

function NewExpression(segments, args, afterSegments, meta) {
  FnExpression.call(this, segments, args, afterSegments, meta);
}
NewExpression.prototype = Object.create(FnExpression.prototype);
NewExpression.prototype.constructor = NewExpression;
NewExpression.prototype.type = 'NewExpression';
NewExpression.prototype._applyFn = function(Fn, context) {
  // Apply if there are no path inputs
  if (!this.args) return new Fn();
  // Otherwise, get the current value for path inputs and apply
  var inputs = this._getInputs(context);
  inputs.unshift(null);
  return new (Fn.bind.apply(Fn, inputs))();
};

function OperatorExpression(name, args, afterSegments, meta) {
  this.name = name;
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = meta;
  this.getFn = operatorFns.get[name];
  this.setFn = operatorFns.set[name];
}
OperatorExpression.prototype = Object.create(FnExpression.prototype);
OperatorExpression.prototype.constructor = OperatorExpression;
OperatorExpression.prototype.type = 'OperatorExpression';
OperatorExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.args, this.afterSegments, this.meta);
};
OperatorExpression.prototype.apply = function(context) {
  var inputs = this._getInputs(context);
  return this.getFn.apply(null, inputs);
};
OperatorExpression.prototype.set = function(context, value) {
  var inputs = this._getInputs(context);
  inputs.unshift(value);
  var out = this.setFn.apply(null, inputs);
  for (var i in out) {
    this.args[i].set(context, out[i]);
  }
};

function SequenceExpression(args, afterSegments, meta) {
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = meta;
}
SequenceExpression.prototype = Object.create(OperatorExpression.prototype);
SequenceExpression.prototype.constructor = SequenceExpression;
SequenceExpression.prototype.type = 'SequenceExpression';
SequenceExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.args, this.afterSegments, this.meta);
};
SequenceExpression.prototype.name = ',';
SequenceExpression.prototype.getFn = operatorFns.get[','];
SequenceExpression.prototype.resolve = function(context) {
  var last = this.args[this.args.length - 1];
  return last.resolve(context);
};
SequenceExpression.prototype.dependencies = function(context, options) {
  var dependencies = [];
  for (var i = 0, len = this.args.length; i < len; i++) {
    var argDependencies = this.args[i].dependencies(context, options);
    for (var j = 0, jLen = argDependencies.length; j < jLen; j++) {
      dependencies.push(argDependencies[j]);
    }
  }
  return dependencies;
};

// For each method that takes a context argument, get the nearest parent view
// context, then delegate methods to the inner expression
function ViewParentExpression(expression, meta) {
  this.expression = expression;
  this.meta = meta;
}
ViewParentExpression.prototype = Object.create(Expression.prototype);
ViewParentExpression.prototype.constructor = ViewParentExpression;
ViewParentExpression.prototype.type = 'ViewParentExpression';
ViewParentExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.meta);
};
ViewParentExpression.prototype.get = function(context) {
  var parentContext = context.forViewParent();
  return this.expression.get(parentContext);
};
ViewParentExpression.prototype.resolve = function(context) {
  var parentContext = context.forViewParent();
  return this.expression.resolve(parentContext);
};
ViewParentExpression.prototype.dependencies = function(context, options) {
  var parentContext = context.forViewParent();
  return this.expression.dependencies(parentContext, options);
};
ViewParentExpression.prototype.pathSegments = function(context) {
  var parentContext = context.forViewParent();
  return this.expression.pathSegments(parentContext);
};
ViewParentExpression.prototype.set = function(context, value) {
  var parentContext = context.forViewParent();
  return this.expression.set(parentContext, value);
};

function ScopedModelExpression(expression, meta) {
  this.expression = expression;
  this.meta = meta;
}
ScopedModelExpression.prototype = Object.create(Expression.prototype);
ScopedModelExpression.prototype.constructor = ScopedModelExpression;
ScopedModelExpression.prototype.type = 'ScopedModelExpression';
ScopedModelExpression.prototype.serialize = function() {
  return serializeObject.instance(this, this.expression, this.meta);
};
// Return a scoped model instead of the value
ScopedModelExpression.prototype.get = function(context) {
  var segments = this.pathSegments(context);
  if (!segments) return;
  return context.controller.model.scope(segments.join('.'));
};
// Delegate other methods to the inner expression
ScopedModelExpression.prototype.resolve = function(context) {
  return this.expression.resolve(context);
};
ScopedModelExpression.prototype.dependencies = function(context, options) {
  return this.expression.dependencies(context, options);
};
ScopedModelExpression.prototype.pathSegments = function(context) {
  return this.expression.pathSegments(context);
};
ScopedModelExpression.prototype.set = function(context, value) {
  return this.expression.set(context, value);
};

function getDependencies(value, context, options) {
  if (value instanceof Expression || value instanceof Template) {
    return value.dependencies(context, options);
  }
}

function appendDependency(dependencies, expression, context) {
  var segments = expression.resolve(context);
  if (!segments) return dependencies;
  if (dependencies) {
    dependencies.push(segments);
    return dependencies;
  }
  return [segments];
}

function swapLastDependency(dependencies, expression, context) {
  if (!expression.segments.length) {
    return dependencies;
  }
  var segments = expression.resolve(context);
  if (!segments) return dependencies;
  if (dependencies) {
    dependencies.pop();
    dependencies.push(segments);
    return dependencies;
  }
  return [segments];
}
