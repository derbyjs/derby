module.exports = {
  ExpressionMeta: ExpressionMeta
, templateTruthy: templateTruthy

, Expression: Expression
, LiteralExpression: LiteralExpression
, PathExpression: PathExpression
, BracketsExpression: BracketsExpression
, FnExpression: FnExpression

, Context: Context
, ContextMeta: ContextMeta
, ObjectModel: ObjectModel

, templateTruthy: templateTruthy
};

function Expression() {}
Expression.prototype.toString = function() {
  return this.source;
};
Expression.prototype.get = function(context) {
  return context.model._get(expandSegments(context.segments));
};
Expression.prototype.truthy = function(context) {
  return templateTruthy(this.get(context));
};

function ExpressionMeta(source) {
  this.source = source;
  this.blockType = null;
  this.as = null;
  this.unescaped = false;
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
  return this.context.model._get(context.segments);
};
Expression.prototype.resolve = function() {};
Expression.prototype.dependencies = function() {};

function LiteralExpression(value) {
  this.value = value;
  this.meta = null;
}
LiteralExpression.prototype = new Expression();
LiteralExpression.prototype.get = function() {
  return this.value;
};

function PathExpression(segments, relative) {
  var alias = null;
  var firstSegment = segments && segments[0];
  if (typeof firstSegment === 'string' && firstSegment.charAt(0) === '#') {
    alias = firstSegment;
    segments.shift();
  }
  this.segments = segments;
  this.relative = relative;
  this.alias = alias;
  this.meta = null;
}
PathExpression.prototype = new Expression();

// Resolve returns a segment list at which the expression's value can be found.
// The segment list contains references to contexts in place of numbers when
// floating item numbers are involved.
PathExpression.prototype.get = function(context) {
  var segments = this.resolve(context);
  return context.model._get(expandSegments(segments));
};
PathExpression.prototype.resolve = function(context) {
  if (this.relative) {
    return (context.segments || []).concat(this.segments);
  }
  if (this.alias) {
    var segments = context.resolveAlias(this.alias);
    return segments.concat(this.segments);
  }
  if (context.item != null) {
    return this.segments.concat(context);
  }
  return this.segments;
};
PathExpression.prototype.dependencies = function(context, forInnerPath) {
  if (forInnerPath) return;
  return [this.resolve(context)];
};

function BracketsExpression(before, inside, after) {
  this.before = before;
  this.inside = inside;
  this.after = after;
  this.meta = null;
}
BracketsExpression.prototype = new PathExpression();
BracketsExpression.prototype.resolve = function(context) {
  var inside = this.inside.get(context);
  if (inside == null || inside === '') {
    return ['$null'];
  }
  // Shouldn't before and inside be segment lists or expressions instead of strings?
  var insideSegments = castSegments(inside.toString().split('.'));
  var segments = this.before && this.before.resolve(context);
  var afterSegments = this.after && this.after.resolve(context);
  segments = (segments) ? segments.concat(insideSegments) : insideSegments;
  return (afterSegments) ? segments.concat(afterSegments) : segments;
};
BracketsExpression.prototype.dependencies = function(context, forInnerPath) {
  var insideDependencies = this.inside.dependencies(context);
  var dependencies = (forInnerPath) ?
    insideDependencies :
    [this.resolve(context)].concat(insideDependencies);
  var beforeDependencies = this.before.dependencies(context, true);
  return (beforeDependencies) ?
    dependencies.concat(beforeDependencies) :
    dependencies;
};

function FnExpression(name, args) {
  this.name = name;
  this.args = args;
  this.meta = null;
}
FnExpression.prototype = new Expression();
FnExpression.prototype.get = function(context) {
  var fn = context.meta.fns[this.name];
  var getFn = fn && fn.get;
  if (!getFn) {
    throw new Error('Function not found for: ' + this.source);
  }
  if (!this.args) return getFn.call(null);
  var inputs = [];
  for (var i = 0, len = this.args.length; i < len; i++) {
    inputs.push(this.args[i].get(context));
  }
  return getFn.apply(null, inputs);
};
FnExpression.prototype.dependencies = function(context) {
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
};

function ContextMeta(options) {
  this.onAdd = options.onAdd;
  this.onRemove = options.onRemove;
  this.fns = options.fns || {};
}

function Context(meta, model, parent, segments, alias) {
  this.meta = meta;
  this.model = model;
  this.parent = parent;
  this.segments = segments;
  this.alias = alias;

  // For item contexts, the last item in the segment list is a reference to this context.
  this.item = null;
}
Context.prototype.onAdd = function(binding) {
  this.meta.onAdd(binding);
};
Context.prototype.onRemove = function(binding) {
  this.meta.onRemove(binding);
};

Context.prototype.child = function(expression) {
  var segments = expression.resolve(this);
  var alias = expression.as;
  return new Context(this.meta, this.model, this, segments, alias);
};

// Make a context for an item in an each block.
Context.prototype.eachChild = function(index) {
  var segments = this.segments.slice();
  var context = new Context(this.meta, this.model, this, segments, this.alias);

  // Could do this in a separate constructor or something, but this is the only
  // place a context is configured like this. Whatever.
  context.item = index;
  segments.push(context);

  return context;
};
Context.prototype.resolveAlias = function(alias) {
  var context = this;
  while (context) {
    if (context.alias === alias) return context.segments;
    context = context.parent;
  }
  throw new Error('Alias not found: ' + alias);
};

// A wrapper around a plain JavaScript object to give it the same getter
// interface as a Racer Model
function ObjectModel(data) {
  this.data = data;
}
ObjectModel.prototype._get = function(segments) {
  var value = this.data;
  if (!segments) return value;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (!value) return value;
    value = value[segments[i]];
  }
  return value;
};

// TODO: DRY; Expose as util from Racer
function castSegments(segments) {
  // Cast number path segments from strings to numbers
  for (var i = segments.length; i--;) {
    var segment = segments[i];
    if (typeof segment === 'string' && isArrayIndex(segment)) {
      segments[i] = +segment;
    }
  }
  return segments;
}

function isArrayIndex(segment) {
  return (/^[0-9]+$/).test(segment);
}
