module.exports = {
  createPathExpression: createPathExpression
, Context: Context
, ContextMeta: ContextMeta
};

function createPathExpression(source) {
  for (var i = 0, len = source.length; i < len; i++) {
    var character = source.charAt(i);
    if (character === '[') return new BracketsExpression(source);
    if (character === '(') return new FnExpression(source);
  }
  return new PathExpression(source);
}

function Expression(source) {
  this.source = source;
}
Expression.prototype.toString = function() {
  return this.source;
};
Expression.prototype.get = function(context) {
  return context.get(this.source);
};

function PathExpression(source) {
  source || (source = '');
  this.source = source;
  this.segments = source.split('.');
  this.relative = false;
  this.alias = null;

  var firstSegment = this.segments[0];
  if (firstSegment === 'this' || firstSegment === '') {
    this.relative = true;
    this.segments.shift();
  } else if (firstSegment.charAt(0) === ':') {
    this.alias = firstSegment;
    this.segments.shift();
  }
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
PathExpression.prototype.dependencies = function(context, forFragment) {
  if (forFragment) return;
  return [this.resolve(context)];
};

function BracketsExpression(source) {
  this.source = source;
  var tokens = parseCall(source, '[', ']');
  this.before = tokens.before && createPathExpression(tokens.before);
  this.inside = createPathExpression(tokens.inside);
  this.after = tokens.after && createPathExpression(tokens.after);
}
BracketsExpression.prototype = new PathExpression();
BracketsExpression.prototype.resolve = function(context) {
  var inside = this.inside.get(context);
  if (inside == null || inside === '') {
    return ['$null'];
  }
  var insideSegments = inside.toString().split('.');
  var segments = this.before && this.before.resolve(context);
  var afterSegments = this.after && this.after.resolve(context);
  segments = (segments) ? segments.concat(insideSegments) : insideSegments;
  return (afterSegments) ? segments.concat(afterSegments) : segments;
};
BracketsExpression.prototype.dependencies = function(context, forFragment) {
  var insideDependencies = this.inside.dependencies(context);
  var dependencies = (forFragment) ?
    insideDependencies :
    [this.resolve(context)].concat(insideDependencies);
  var afterDependencies = this.after && this.after.dependencies(context, true);
  return (afterDependencies) ?
    dependencies.concat(afterDependencies) :
    dependencies;
};

function FnExpression(source) {
  this.source = source;
  var tokens = parseCall(source, '(', ')');
  this.name = tokens.before;
  this.args = fnArgs(tokens.inside);
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
    dependencies.push(this.args[i].dependencies(context));
  }
  return dependencies;
};

function fnArgs(inside) {
  if (!inside) return;
  var args = [];
  var argSeparator = /\s*([,(])\s*/g;
  var notSeparator = /[^,\s]/g;
  var lastIndex = 0;
  var match;
  while (match = argSeparator.exec(inside)) {
    if (match[1] === '(') {
      var end = matchBraces(inside, 1, argSeparator.lastIndex, '(', ')');
      var source = inside.slice(lastIndex, end);
      args.push(createPathExpression(source));
      notSeparator.lastIndex = end;
      lastIndex = argSeparator.lastIndex =
        notSeparator.test(inside) ? notSeparator.lastIndex - 1 : end;
      continue;
    }
    var source = inside.slice(lastIndex, match.index);
    args.push(createPathExpression(source));
    lastIndex = argSeparator.lastIndex;
  }
  var source = inside.slice(lastIndex);
  if (source) args.push(createPathExpression(source));
  return args;
}

function ContextMeta(fns) {
  this.fns = fns || {};
}

function Context(events, data, meta, parent, segments, alias) {
  this.events = events;
  this.data = data;
  this.meta = meta;
  this.parent = parent;
  this.segments = segments;
  this.alias = alias;
}
Context.prototype.get = function(segments) {
  return lookup(this.data, segments);
};
Context.prototype.child = function(expression, alias) {
  var segments = expression.resolve();
  return new Context(this.events, this.data, this.meta, this, segments, alias);
};
Context.prototype.resolveAlias = function(alias) {
  var context = this;
  while (context) {
    if (context.alias === alias) return context.segments;
    context = context.parent;
  }
  throw new Error('Alias not found: ' + alias);
};

function ModelContext(events, data, parent) {
  this.events = events;
  this.data = data;
  this.parent = parent;
}
ModelContext.prototype = new Context();

function lookup(obj, segments) {
  if (!obj || !segments) return;

  for (var i = 0, len = segments.length; i < len; i++) {
    if (!obj) return obj;
    obj = obj[segments[i]];
  }
  return obj;
}

function CallTokens(before, inside, after) {
  this.before = before;
  this.inside = inside;
  this.after = after;
}
function parseCall(source, openChar, closeChar) {
  var i = source.indexOf(openChar);
  if (i === -1) {
    throw new Error('Missing `' + openChar + '` in expression: ' + source);
  }
  var end = matchBraces(source, 1, i, openChar, closeChar);
  if (end === -1) {
    throw new Error('Missing `' + closeChar + '` in expression: ' + source);
  }
  var before = source.slice(0, i);
  var inside = source.slice(i + 1, end - 1);
  var after = source.slice(end);
  return new CallTokens(before, inside, after);
}

function matchBraces(text, num, i, openChar, closeChar) {
  i++;
  while (num) {
    var close = text.indexOf(closeChar, i);
    var open = text.indexOf(openChar, i);
    var hasClose = close !== -1;
    var hasOpen = open !== -1;
    if (hasClose && (!hasOpen || (close < open))) {
      i = close + 1;
      num--;
      continue;
    } else if (hasOpen) {
      i = open + 1;
      num++;
      continue;
    } else {
      return -1;
    }
  }
  return i;
}
