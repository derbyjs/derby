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

function ExpressionMeta(source) {
  this.source = source;
  this.blockType = null;
  this.as = null;
  this.unescaped = false;
  this.bindType = null;
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
  return context.model._get(expandSegments(context.segments));
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
  var result = context.model._get(expandSegments(segments));
  
  return result;
};
PathExpression.prototype.resolve = function(context) {
  if (this.relative) {
    return (context.expression) ?
      context.expression.resolve(context).concat(this.segments) :
      this.segments;

  } else if (this.alias) {
    var aliasContext = context.resolveAlias(this.alias);
    return aliasContext.expression.resolve(aliasContext).concat(this.segments);

  } else if (context.item != null) {
    return this.segments.concat(context);

  } else {
    return this.segments;
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
    var alias = context.resolveAlias(this.alias);
    return alias.expression.dependancies(alias);
  }
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

function ContextMeta(options) {
  this.onAdd = options.onAdd;
  this.onRemove = options.onRemove;
  this.fns = options.fns || {};
}

function Context(meta, model, parent, expression) {
  this.meta = meta;
  this.model = model;
  this.parent = parent;
  this.expression = expression;
  this.alias = expression ? expression.as : null;

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
  return new Context(this.meta, this.model, this, expression);
};

// Make a context for an item in an each block.
Context.prototype.eachChild = function(index) {
  var context = new Context(this.meta, this.model, this, this.expression);
  context.item = index;
  return context;
};

// Returns the context which created the named alias.
Context.prototype.resolveAlias = function(alias) {
  var context = this;
  while (context) {
    if (context.alias === alias) return context;
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
