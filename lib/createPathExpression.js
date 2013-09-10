var expressions = require('./expressions');
var esprima = require('esprima-derby');
var Syntax = esprima.Syntax;

module.exports = createPathExpression;

function createPathExpression(source) {
  var node = esprima.parse(source).expression;
  return reduce(node);
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
  } else if (type === Syntax.Literal) {
    return reduceLiteral(node);
  } else if (type === Syntax.UnaryExpression) {
    return reduceUnaryExpression(node);
  } else if (type === Syntax.BinaryExpression || type === Syntax.LogicalExpression) {
    return reduceBinaryExpression(node);
  } else if (type === Syntax.ConditionalExpression) {
    return reduceConditionalExpression(node);
  } else if (type === Syntax.ArrayExpression) {
    return reduceArrayExpression(node);
  } else if (type === Syntax.ObjectExpression) {
    return reduceObjectExpression(node);
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
    return new expressions.BracketsExpression(before, inside, remaining);
  }
  // Dot notation
  if (node.property.type === Syntax.Identifier) {
    return reducePath(node, node.property.name);
  }
  unexpected(node);
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

function reduceLiteral(node) {
  return new expressions.LiteralExpression(node.value);
}

function reduceUnaryExpression(node) {
  var expression = reduce(node.argument);
  if (expression instanceof expressions.LiteralExpression) {
    expression.value = applyUnaryOperator(node, expression.value);
    return expression;
  }
  return new expressions.FnExpression(node.operator, [expression]);
}

function reduceBinaryExpression(node) {
  var left = reduce(node.left);
  var right = reduce(node.right);
  if (
    left instanceof expressions.LiteralExpression &&
    right instanceof expressions.LiteralExpression
  ) {
    var value = applyBinaryOperator(node, left.value, right.value);
    return new expressions.LiteralExpression(value);
  }
  return new expressions.FnExpression(node.operator, [left, right]);
}

function reduceConditionalExpression(node) {
  var test = reduce(node.test);
  var consequent = reduce(node.consequent);
  var alternate = reduce(node.alternate);
  if (
    test instanceof expressions.LiteralExpression &&
    consequent instanceof expressions.LiteralExpression &&
    alternate instanceof expressions.LiteralExpression
  ) {
    var value = (test.value) ? consequent.value : alternate.value;
    return new expressions.LiteralExpression(value);
  }
  return new expressions.FnExpression('?', [test, consequent, alternate]);
}

function applyUnaryOperator(node, value) {
  var operator = node.operator;
  return (operator === '!') ? !value :
    (operator === '-') ? -value :
    (operator === '+') ? +value :
    (operator === '~') ? ~value :
    (operator === 'typeof') ? typeof value :
    unexpected(node);
}

function applyBinaryOperator(node, left, right) {
  var operator = node.operator;
  return (operator === '||') ? left || right :
    (operator === '&&') ? left && right :
    (operator === '|') ? left | right :
    (operator === '^') ? left ^ right :
    (operator === '&') ? left & right :
    (operator === '==') ? left == right :
    (operator === '!=') ? left != right :
    (operator === '===') ? left === right :
    (operator === '!==') ? left !== right :
    (operator === '<') ? left < right :
    (operator === '>') ? left > right :
    (operator === '<=') ? left <= right :
    (operator === '>=') ? left >= right :
    (operator === 'instanceof') ? left instanceof right :
    (operator === 'in') ? left in right :
    (operator === '<<') ? left << right :
    (operator === '>>') ? left >> right :
    (operator === '>>>') ? left >>> right :
    (operator === '+') ? left + right :
    (operator === '-') ? left - right :
    (operator === '*') ? left * right :
    (operator === '/') ? left / right :
    (operator === '%') ? left % right :
    unexpected(node);
}

function reduceArrayExpression(node) {
  var elements = node.elements;
  var literal = [];
  var args = [];
  var isLiteral = true;
  for (var i = 0, len = elements.length; i < len; i++) {
    var expression = reduce(elements[i]);
    args.push(expression);
    if (isLiteral && expression instanceof expressions.LiteralExpression) {
      literal.push(expression.value);
    } else {
      isLiteral = false;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.FnExpression('$array', args);
}

function reduceObjectExpression(node) {
  var properties = node.properties;
  var literal = {};
  var args = [];
  var isLiteral = true;
  for (var i = 0, len = properties.length; i < len; i++) {
    var property = properties[i];
    var key = getKeyName(property.key);
    var keyExpression = new expressions.LiteralExpression(key);
    var expression = reduce(property.value);
    args.push(keyExpression, expression);
    if (isLiteral && expression instanceof expressions.LiteralExpression) {
      literal[key] = expression.value;
    } else {
      isLiteral = false;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.FnExpression('$object', args);
}

function getKeyName(key) {
  return (key.type === Syntax.Identifier) ? key.name :
    (key.type === Syntax.Literal) ? key.value :
    unexpected(key);
}

function unexpected(node) {
  throw new Error('Unexpected Esprima node: ' + JSON.stringify(node, null, 2));
}
