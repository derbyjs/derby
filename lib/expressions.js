var defaultFns = require('./defaultFns');

module.exports = {
  ExpressionMeta: ExpressionMeta
, templateTruthy: templateTruthy

, Expression: Expression
, LiteralExpression: LiteralExpression
, PathExpression: PathExpression
, BracketsExpression: BracketsExpression
, FnExpression: FnExpression
, SequenceExpression: SequenceExpression

, Context: Context
, ContextMeta: ContextMeta
, ObjectModel: ObjectModel

, templateTruthy: templateTruthy
};

function ExpressionMeta(source) {
  this.source = source;
  this.blockType = null;
  this.isEnd = false;
  this.as = null;
  this.unescaped = false;
  this.bindType = null;
  this.valueType = null;
}

function templateTruthy(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value != null && value !== false && value !== '';
}

// Segments for expressions have references to item contexts instead of numbers
// for eaches.  For example, instead of storing ['users', 1, 'x'] the segments
// will be ['users', <context>, 'x'], with context.item = 1.
//
// expandSegments returns a copy of the segments list containing only primitive values.
function expandSegments(segments) {
  var result = new Array(segments.length);
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    result[i] = typeof segment === 'object' ? segment.item : segment;
  }

  return result;
}

function Expression() {
  this.meta = null;
}
Expression.prototype.toString = function() {
  return this.meta && this.meta.source;
};
Expression.prototype.truthy = function(context) {
  var blockType = this.meta.blockType;
  if (blockType === 'else') return true;
  var value = templateTruthy(this.get(context));
  return (blockType === 'unless') ? !value : value;
};
Expression.prototype.get = function(context) {
  return context.get();
};
// Resolve returns the expression's segment list in a context.
Expression.prototype.resolve = function() {};
// Dependancies returns a list of Dependancy objects for this expression, or null.
Expression.prototype.dependencies = function() {};

function LiteralExpression(value) {
  this.value = value;
  this.meta = null;
}
LiteralExpression.prototype = new Expression();
LiteralExpression.prototype.get = function(context) {
  return getPatch(this, context, this.value);
};

function PathExpression(segments, relative) {
  var alias, attribute;
  var firstSegment = segments && segments[0];
  var firstChar = (typeof firstSegment === 'string') && firstSegment.charAt(0);
  if (firstChar === '#') {
    alias = firstSegment;
    segments.shift();
  } else if (firstChar === '@') {
    attribute = firstSegment.slice(1);
    segments.shift();
  }
  this.segments = segments;
  this.relative = relative;
  this.alias = alias;
  this.attribute = attribute;
  this.meta = null;
}
PathExpression.prototype = new Expression();

PathExpression.prototype.get = function(context) {
  if (this.relative) {
    var value = (this.meta && this.meta.blockType) ?
      context.parent.get() :
      context.get();
    value = lookup(this.segments, value);
    return getPatch(this, context, value);

  } else if (this.alias) {
    var value = context.forAlias(this.alias).get();
    value = lookup(this.segments, value);
    return getPatch(this, context, value);

  } else if (this.attribute) {
    var attributeContext = context.forAttribute(this.attribute);
    var value = attributeContext &&
      attributeContext.attributes[this.attribute].get(attributeContext.parent);
    value = lookup(this.segments, value);
    return getPatch(this, context, value);

  } else {
    var value = context.model._get(this.segments);
    return getPatch(this, context, value);
  }
};

// Resolve returns a segment list at which the expression's value can be found.
// The segment list contains references to contexts in place of numbers when
// floating item numbers are involved.
PathExpression.prototype.resolve = function(context) {
  if (this.relative) {
    if (context.expression) {
      var base = context.expression.resolve(context);
      return base && base.concat(this.segments);
    }
    return this.segments;

  } else if (this.alias) {
    var aliasContext = context.forAlias(this.alias);
    var base = aliasContext.expression.resolve(aliasContext);
    return base && base.concat(this.segments);

  } else if (this.attribute) {
    var attributeContext = context.forAttribute(this.attribute);
    var base = attributeContext &&
      attributeContext.attributes[this.attribute].resolve(attributeContext);
    return base && base.concat(this.segments);

  } else {
    return resolvePatch(this, context, this.segments);
  }
};
PathExpression.prototype.dependencies = function(context) {
  // PathExpressions don't naturally have any dependancies, but if we're an
  // alias or relative path, we need to return any dependancies which make up
  // our ancestor (eg, {{ with foo[bar] }} ... {{ this.x }} has 'bar' as a
  // dependancy.
  if (this.relative) {
    return context.expression.dependancies(context);
  } else if (this.alias) {
    var alias = context.forAlias(this.alias);
    return alias.expression.dependancies(alias);
  }
};

function BracketsExpression(before, inside, afterSegments) {
  this.before = before;
  this.inside = inside;
  this.afterSegments = afterSegments;
  this.meta = null;
}
BracketsExpression.prototype = new Expression();
BracketsExpression.prototype.get = function(context) {
  var inside = this.inside.get(context);
  if (inside == null) return;
  var before = this.before.get(context);
  if (!before) return;
  var base = before[inside];
  var value = (this.afterSegments) ? lookup(this.afterSegments, base) : base;
  return getPatch(this, context, value);
};
BracketsExpression.prototype.resolve = function(context) {
  // Get and split the current value of the expression inside the brackets
  var inside = this.inside.get(context);
  if (inside == null) return;

  // Concat the before, inside, and optional after segments
  var segments = this.before.resolve(context);
  if (!segments) return;
  var segments = (this.afterSegments) ?
    segments.concat(inside, this.afterSegments) :
    segments.concat(inside);
  return resolvePatch(this, context, segments);
};
BracketsExpression.prototype.dependencies = function(context, forInnerPath) {
  /*
  var insideDependencies = this.inside.dependencies(context);
  var dependencies = (forInnerPath) ?
    insideDependencies :
    [this.resolve(context)].concat(insideDependencies);
  var beforeDependencies = this.before.dependencies(context, true);
  return (beforeDependencies) ?
    dependencies.concat(beforeDependencies) :
    dependencies;
  */
};

function FnExpression(name, args, afterSegments) {
  this.name = name;
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = null;
}
FnExpression.prototype = new Expression();
FnExpression.prototype.get = function(context) {
  var fn = context.meta.fns[this.name] || defaultFns[this.name];
  var getFn = fn && fn.get;
  if (!getFn) {
    throw new Error('Function not found for: ' + this.source);
  }
  if (!this.args) return getFn.call(null);
  var inputs = [];
  for (var i = 0, len = this.args.length; i < len; i++) {
    inputs.push(this.args[i].get(context));
  }
  var value = getFn.apply(null, inputs);
  if (this.afterSegments) {
    value = lookup(this.afterSegments, value);
  }
  return getPatch(this, context, value);
};
FnExpression.prototype.dependencies = function(context) {
  /*
  var dependencies = [];
  if (!this.args) return dependencies;
  for (var i = 0, len = this.args.length; i < len; i++) {
    var argDependencies = this.args[i].dependencies(context);
    var firstDependency = argDependencies && argDependencies[0];
    if (!firstDependency) continue;
    if (firstDependency[firstDependency.length - 1] !== '*') {
      argDependencies[0] = argDependencies[0].concat('*');
    }
    for (var j = 0, jLen = argDependencies.length; j < jLen; j++) {
      dependencies.push(argDependencies[j]);
    }
  }
  return dependencies;
  */
};

function SequenceExpression(args, afterSegments) {
  this.name = ',';
  this.args = args;
  this.afterSegments = afterSegments;
  this.meta = null;
}
SequenceExpression.prototype = new FnExpression();
SequenceExpression.prototype.resolve = function(context) {
  var last = this.args[this.args.length - 1];
  return last.resolve(context);
};
SequenceExpression.prototype.dependencies = function(context) {
  var last = this.args[this.args.length - 1];
  return last.dependencies(context);
};

function ContextMeta(options) {
  this.onAdd = options.onAdd;
  this.onRemove = options.onRemove;
  this.fns = options.fns || {};
  this.views = options.views;
}

function Context(meta, model, parent, expression, unbound, at, item, attributes) {
  this.meta = meta;
  this.model = model;
  this.parent = parent;
  this.expression = expression;
  this.unbound = unbound;
  this.at = at;
  this.item = item;
  this.attributes = attributes;
  this.alias = expression && expression.meta.as;
}

Context.prototype.onAdd = function(binding) {
  this.meta.onAdd(binding);
};
Context.prototype.onRemove = function(binding) {
  this.meta.onRemove(binding);
};

Context.prototype.child = function(expression) {
  // Set or inherit the binding mode
  var blockType = expression.meta.blockType;
  var unbound = (blockType === 'unbound') ? true :
    (blockType === 'bound') ? false :
    this.unbound;
  return new Context(this.meta, this.model, this, expression, unbound, this.at);
};

// Make a context for an item in an each block
Context.prototype.eachChild = function(index) {
  return new Context(this.meta, this.model, this, this.expression, this.unbound, this.at, index);
};

Context.prototype.viewChild = function(at, attributes) {
  return new Context(this.meta, this.model, this, this.expression, this.unbound, at, null, attributes);
};

// Returns the closest context which defined the named alias
Context.prototype.forAlias = function(alias) {
  var context = this;
  while (context) {
    if (context.alias === alias) return context;
    context = context.parent;
  }
  throw new Error('Alias not found: ' + alias);
};

// Returns the closest containing context for a view attribute name or nothing
Context.prototype.forAttribute = function(attribute) {
  var context = this;
  while (context) {
    // Find the closest context associated with a view
    if (context.at) {
      var attributes = context.attributes;
      if (!attributes) return;
      if (attributes.hasOwnProperty(attribute)) return context;
      // If the attribute isn't found, but the attributes inherit, continue
      // looking in the next closest view context
      if (!attributes.inherit) return;
    }
    context = context.parent;
  }
};

// Returns the `this` value for a context
Context.prototype.get = function() {
  return (this.expression) ? this.expression.get(this) : this.model._get();
};

function getPatch(expression, context, value) {
  return (context && expression === context.expression && context.item != null) ?
    value && value[context.item] :
    value;
}

function resolvePatch(expression, context, segments) {
  return (context && expression === context.expression && context.item != null) ?
    segments.concat(context) :
    segments;
}

// A wrapper around a plain JavaScript object to give it the same getter
// interface as a Racer Model
function ObjectModel(data) {
  this.data = data;
}
ObjectModel.prototype._get = function(segments) {
  return lookup(segments, this.data);
};

function lookup(segments, value) {
  if (!segments) return value;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (!value) return value;
    value = value[segments[i]];
  }
  return value;
}
