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
  } else if (type === Syntax.Literal) {
    return reduceLiteral(node);
  } else if (type === Syntax.UnaryExpression) {
    return reduceUnaryExpression(node);
  } else if (type === Syntax.BinaryExpression || type === Syntax.LogicalExpression) {
    return reduceBinaryExpression(node);
  } else if (type === Syntax.ConditionalExpression) {
    return reduceConditionalExpression(node);
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

function unexpected(node) {
  throw new Error('Unexpected Esprima node: ' + JSON.stringify(node, null, 2));
}
