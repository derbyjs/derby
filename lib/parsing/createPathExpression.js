var derbyTemplates = require('derby-templates');
var expressions = derbyTemplates.expressions;
var operatorFns = derbyTemplates.operatorFns;
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
  } else if (type === Syntax.SequenceExpression) {
    return reduceSequenceExpression(node);
  } else if (type === Syntax.NewExpression) {
    return reduceNewExpression(node);
  }
  unexpected(node);
}

function reduceMemberExpression(node, afterSegments) {
  if (node.computed) {
    // Square brackets
    if (node.property.type === Syntax.Literal) {
      return reducePath(node, node.property.value, afterSegments);
    }
    var before = reduce(node.object);
    var inside = reduce(node.property);
    return new expressions.BracketsExpression(before, inside, afterSegments);
  }
  // Dot notation
  if (node.property.type === Syntax.Identifier) {
    return reducePath(node, node.property.name);
  }
  unexpected(node);
}

function reducePath(node, segment, afterSegments) {
  var segments = [segment];
  if (afterSegments) segments = segments.concat(afterSegments);
  var relative = false;
  while (node = node.object) {
    if (node.type === Syntax.MemberExpression) {
      if (node.computed) {
        return reduceMemberExpression(node, segments);
      } else if (node.property.type === Syntax.Identifier) {
        segments.unshift(node.property.name);
      } else {
        unexpected(node);
      }
    } else if (node.type === Syntax.Identifier) {
      segments.unshift(node.name);
    } else if (node.type === Syntax.ThisExpression) {
      relative = true;
    } else if (node.type === Syntax.CallExpression) {
      return reduceCallExpression(node, segments);
    } else if (node.type === Syntax.SequenceExpression) {
      return reduceSequenceExpression(node, segments);
    } else if (node.type === Syntax.NewExpression) {
      return reduceNewExpression(node, segments);
    } else {
      unexpected(node);
    }
  }
  return (relative) ?
    new expressions.RelativePathExpression(segments) :
    createSegmentsExpression(segments);
}

function reduceIdentifier(node) {
  var segments = [node.name];
  return createSegmentsExpression(segments);
}

function reduceThis(node) {
  var segments = [];
  return new expressions.RelativePathExpression(segments);
}

function createSegmentsExpression(segments) {
  var firstSegment = segments[0];
  var firstChar = firstSegment.charAt && firstSegment.charAt(0);

  if (firstChar === '#') {
    var alias = firstSegment;
    segments.shift();
    return new expressions.AliasPathExpression(alias, segments);

  } else if (firstChar === '@') {
    var attribute = firstSegment.slice(1);
    segments.shift();
    return new expressions.AttributePathExpression(attribute, segments);

  } else {
    return new expressions.PathExpression(segments);
  }
}

function reduceCallExpression(node, afterSegments) {
  return reduceFnExpression(node, afterSegments, expressions.FnExpression);
}

function reduceNewExpression(node, afterSegments) {
  return reduceFnExpression(node, afterSegments, expressions.NewExpression);
}

function reduceFnExpression(node, afterSegments, Constructor) {
  var args = node.arguments.map(reduce);
  var callee = node.callee;
  if (callee.type === Syntax.Identifier) {
    if (callee.name === '$at') {
      return new expressions.ScopedModelExpression(args[0]);
    }
    var segments = [callee.name];
    return new Constructor(segments, args, afterSegments);
  } else if (callee.type === Syntax.MemberExpression) {
    var segments = reduceMemberExpression(callee).segments;
    return new Constructor(segments, args, afterSegments);
  } else {
    unexpected(node);
  }
}

function reduceLiteral(node) {
  return new expressions.LiteralExpression(node.value);
}

function reduceUnaryExpression(node) {
  // `-` and `+` can be either unary or binary, so all unary operators are
  // postfixed with `U` to differentiate
  var operator = node.operator + 'U';
  var expression = reduce(node.argument);
  if (expression instanceof expressions.LiteralExpression) {
    var fn = operatorFns.get[operator];
    expression.value = fn(expression.value);
    return expression;
  }
  return new expressions.OperatorExpression(operator, [expression]);
}

function reduceBinaryExpression(node) {
  var operator = node.operator;
  var left = reduce(node.left);
  var right = reduce(node.right);
  if (
    left instanceof expressions.LiteralExpression &&
    right instanceof expressions.LiteralExpression
  ) {
    var fn = operatorFns.get[operator];
    var value = fn(left.value, right.value);
    return new expressions.LiteralExpression(value);
  }
  return new expressions.OperatorExpression(operator, [left, right]);
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
  return new expressions.OperatorExpression('?', [test, consequent, alternate]);
}

function reduceArrayExpression(node) {
  var literal = [];
  var items = [];
  var isLiteral = true;
  for (var i = 0; i < node.elements.length; i++) {
    var expression = reduce(node.elements[i]);
    items.push(expression);
    if (isLiteral && expression instanceof expressions.LiteralExpression) {
      literal.push(expression.value);
    } else {
      isLiteral = false;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.ArrayExpression(items);
}

function reduceObjectExpression(node) {
  var literal = {};
  var properties = {};
  var isLiteral = true;
  for (var i = 0; i < node.properties.length; i++) {
    var property = node.properties[i];
    var key = getKeyName(property.key);
    var expression = reduce(property.value);
    properties[key] = expression;
    if (isLiteral && expression instanceof expressions.LiteralExpression) {
      literal[key] = expression.value;
    } else {
      isLiteral = false;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.ObjectExpression(properties);
}

function getKeyName(key) {
  return (key.type === Syntax.Identifier) ? key.name :
    (key.type === Syntax.Literal) ? key.value :
    unexpected(key);
}

function reduceSequenceExpression(node, afterSegments) {
  // Note that sequence expressions are not reduced to a literal if they only
  // contain literals. There isn't any utility to such an expression, so it
  // isn't worth optimizing.
  //
  // The fact that expressions separated by commas always parse into a sequence
  // is relied upon in parsing template tags that have comma-separated
  // arguments following a keyword
  var args = node.expressions.map(reduce);
  return new expressions.SequenceExpression(args, afterSegments);
}

function unexpected(node) {
  throw new Error('Unexpected Esprima node: ' + JSON.stringify(node, null, 2));
}
