module.exports = {
  createPathExpression: createPathExpression
, Context: Context
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
}
PathExpression.prototype.get = function(context) {
  var segments = this.resolve(context);
  return context.get(segments);
}

function BracketsExpression(source) {
  this.source = source;
  var i = source.indexOf('[');
  var end = matchBraces(source, 1, i, '[', ']');
  if (end === -1) {
    throw new Error('Missing `]` end bracket in expression: ' + source);
  }
  var before = source.slice(0, i);
  var inside = source.slice(i + 1, end - 1);
  var after = source.slice(end);
  this.before = before && createPathExpression(before);
  this.inside = createPathExpression(inside);
  this.after = after && createPathExpression(after);
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

function FnExpression(source) {

}
FnExpression.prototype = new PathExpression();

function Context(events, data, segments, alias, parent) {
  this.events = events;
  this.data = data;
  this.segments = segments;
  this.alias = alias;
  this.parent = parent;
}
Context.prototype.get = function(segments) {
  return lookup(this.data, segments);
};
Context.prototype.child = function(expression, alias) {
  var segments = expression.resolve();
  return new Context(this.events, this.data, segments, alias, this);
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
