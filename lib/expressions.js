module.exports = {
  Expression: Expression
, PathExpression: PathExpression
, BracketsExpression: BracketsExpression
, FnExpression: FnExpression

, Context: Context
, ContextMeta: ContextMeta
, ModelContext: ModelContext
};

function Expression(source) {
  this.source = source;
}
Expression.prototype.toString = function() {
  return this.source;
};
Expression.prototype.get = function(context) {
  return context.get(this.source);
};

function PathExpression(segments, relative) {
  this.source = null;
  this.segments = segments;
  this.relative = relative;

  var alias = null;
  var firstSegment = segments && segments[0];
  if (typeof firstSegment === 'string' && firstSegment.charAt(0) === '#') {
    alias = firstSegment;
    segments.shift();
  }
  this.alias = alias;
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
  return context.get(segments);
};
PathExpression.prototype.dependencies = function(context, forInnerPath) {
  if (forInnerPath) return;
  return [this.resolve(context)];
};

function BracketsExpression(before, inside, after) {
  this.source = null;
  this.before = before;
  this.inside = inside;
  this.after = after;
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
  this.source = null;
  this.name = name;
  this.args = args;
}
FnExpression.prototype = new PathExpression();
FnExpression.prototype.resolve = function() {
  return this;
};
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
    var firstDependency = argDependencies[0];
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

function Context(meta, data, parent, segments, alias) {
  this.meta = meta;
  this.data = data;
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
Context.prototype.get = function(segments) {
  return lookup(this.data, segments);
};
Context.prototype.child = function(expression, alias) {
  var segments = expression.resolve();
  return new Context(this.meta, this.data, this, segments, alias);
};
Context.prototype.resolveAlias = function(alias) {
  var context = this;
  while (context) {
    if (context.alias === alias) return context.segments;
    context = context.parent;
  }
  throw new Error('Alias not found: ' + alias);
};

function ModelContext(meta, model, parent, segments, alias) {
  this.meta = meta;
  this.model = model;
  this.parent = parent;
  this.segments = segments;
  this.alias = alias;
}
ModelContext.prototype = new Context();
ModelContext.prototype.get = function(segments) {
  return this.model._get(segments);
};
ModelContext.prototype.child = function(expression, alias) {
  var segments = expression.resolve();
  return new ModelContext(this.meta, this.model, this, segments, alias);
};

function lookup(obj, segments) {
  if (!obj || !segments) return;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (!obj) return obj;
    obj = obj[segments[i]];
  }
  return obj;
}

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
