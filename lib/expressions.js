module.exports = {
  Expression: Expression
, NotExpression: NotExpression
, ElseExpression: ElseExpression

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
  return context.model._get(context.segments);
};
Expression.prototype.truthy = function(context) {
  return templateTruthy(this.get(context));
};
Expression.prototype.resolve = function() {};
Expression.prototype.dependencies = function() {};

function NotExpression() {}
NotExpression.prototype = new Expression();
NotExpression.prototype.truthy = function(context) {
  return !templateTruthy(this.get(context));
};

function ElseExpression() {}
ElseExpression.prototype = new Expression();
ElseExpression.prototype.truthy = function() {
  return true;
};

function templateTruthy(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value != null && value !== false && value !== '';
}

function LiteralExpression(value) {
  this.value = value;
  this.source = null;
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
  this.source = null;
  this.as = null;
}
PathExpression.prototype = new Expression();
PathExpression.prototype.resolve = function(context) {
  if (this.relative) {
    return (context.segments || []).concat(this.segments);
  }
  if (this.alias) {
    var segments = context.resolveAlias(this.alias);
    return segments.concat(this.segments);
  }
  return this.segments;
};
PathExpression.prototype.get = function(context) {
  var segments = this.resolve(context);
  return context.model._get(segments);
};
PathExpression.prototype.dependencies = function(context, forInnerPath) {
  if (forInnerPath) return;
  return [this.resolve(context)];
};

function BracketsExpression(before, inside, after) {
  this.before = before;
  this.inside = inside;
  this.after = after;
  this.source = null;
  this.as = null;
}
BracketsExpression.prototype = new PathExpression();
BracketsExpression.prototype.resolve = function(context) {
  var inside = this.inside.get(context);
  if (inside == null || inside === '') {
    return ['$null'];
  }
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
  this.source = null;
  this.as = null;
}
FnExpression.prototype = new PathExpression();
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
}
Context.prototype.onAdd = function(binding) {
  this.meta.onAdd(binding);
};
Context.prototype.onRemove = function(binding) {
  this.meta.onRemove(binding);
};
Context.prototype.child = function(expression) {
  var segments = expression.resolve();
  var alias = expression.as;
  return new Context(this.meta, this.model, this, segments, alias);
};
Context.prototype.eachChild = function(index) {
  var segments = this.segments.concat(index);
  return new Context(this.meta, this.model, this, segments, this.alias);
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
