var expressions = require('./expressions');
var esprima = require('esprima-derby');
var Syntax = esprima.Syntax;

module.exports = createPathExpression;

function createPathExpression(source) {
  var expression = esprima.parse(source).expression;
  return reduce(expression);
}

function reduce(node) {
  var type = node.type;
  if (type === Syntax.MemberExpression) {
    return reduceMemberExpression(node);
  } else if (type === Syntax.Identifier) {
    return reduceIdentifier(node);
  } else if (type === Syntax.ThisExpression) {
    return reduceThis(node);
  } else if (type === Syntax.CallExpression) {
    return reduceCallExpression(node);
  }
  unexpected(node);
}

function reduceMemberExpression(node, remaining) {
  if (node.computed) {
    // Square brackets
    if (node.property.type === Syntax.Literal) {
      return reducePath(node, node.property.value, remaining);
    }
    var before = reduce(node.object);
    var inside = reduce(node.property);
    var after;
    if (remaining) after = new expressions.PathExpression(remaining);
    return new expressions.BracketsExpression(before, inside, after);
  }
  // Dot notation
  if (node.property.type === Syntax.Identifier) {
    return reducePath(node, node.property.name);
  }
  unexpected(node);
}

function reduceIdentifier(node) {
  var segments = [node.name];
  return new expressions.PathExpression(segments);
}

function reduceThis(node) {
  var segments = [];
  var relative = true;
  return new expressions.PathExpression(segments, relative);
}

function reduceCallExpression(node) {
  var name = node.callee.name;
  var args = node.arguments.map(reduce);
  return new expressions.FnExpression(name, args);
}

function reducePath(node, segment, remaining) {
  var segments = [segment];
  if (remaining) segments = segments.concat(remaining);
  var relative = false;
  while (node = node.object) {
    if (node.type === Syntax.MemberExpression) {
      if (node.property.type === Syntax.Identifier) {
        segments.unshift(node.property.name);
      } else if (
        node.property.type === Syntax.MemberExpression ||
        node.property.type === Syntax.Literal
      ) {
        return reduceMemberExpression(node, segments);
      } else {
        unexpected(node);
      }
    } else if (node.type === Syntax.Identifier) {
      segments.unshift(node.name);
    } else if (node.type === Syntax.ThisExpression) {
      relative = true;
    } else {
      unexpected(node);
    }
  }
  return new expressions.PathExpression(segments, relative);
}

function unexpected(node) {
  throw new Error('Unexpected Esprima node: ' + JSON.stringify(node, null, 2));
}
