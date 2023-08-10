import { expressions, operatorFns } from '../templates';
import * as esprima from 'esprima-derby';
import * as estree from 'estree';
const { Syntax } = esprima;

export function createPathExpression(source) {
  // @ts-expect-error `parse` not declared in @types/esprima
  const parsed = esprima.parse(source);
  const node = parsed.expression;
  return reduce(node);
}

function reduce(node) {
  const type = node.type;
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

function reduceMemberExpression(node, afterSegments?: string[]) {
  if (node.computed) {
    // Square brackets
    if (node.property.type === Syntax.Literal) {
      return reducePath(node, node.property.value, afterSegments);
    }
    const before = reduce(node.object);
    const inside = reduce(node.property);
    return new expressions.BracketsExpression(before, inside, afterSegments);
  }
  // Dot notation
  if (node.property.type === Syntax.Identifier) {
    return reducePath(node, node.property.name);
  }
  unexpected(node);
}

function reducePath(node, segment, afterSegments?: string[]) {
  let segments = [segment];
  if (afterSegments) segments = segments.concat(afterSegments);
  let relative = false;
  while ((node = node.object)) {
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
  const segments = [node.name];
  return createSegmentsExpression(segments);
}

function reduceThis(_node) {
  const segments = [];
  return new expressions.RelativePathExpression(segments);
}

function createSegmentsExpression(segments) {
  const firstSegment = segments[0];
  const firstChar = firstSegment.charAt && firstSegment.charAt(0);

  if (firstChar === '#') {
    const alias = firstSegment;
    segments.shift();
    return new expressions.AliasPathExpression(alias, segments);

  } else if (firstChar === '@') {
    const attribute = firstSegment.slice(1);
    segments.shift();
    return new expressions.AttributePathExpression(attribute, segments);

  } else {
    return new expressions.PathExpression(segments);
  }
}

function reduceCallExpression(node: estree.CallExpression, afterSegments?: string[]) {
  return reduceFnExpression(node, afterSegments, expressions.FnExpression);
}

function reduceNewExpression(node: estree.NewExpression, afterSegments?: string[]) {
  return reduceFnExpression(node, afterSegments, expressions.NewExpression);
}

function reduceFnExpression(node: estree.CallExpression, afterSegments, Constructor) {
  const args = node.arguments.map(reduce);
  const callee = node.callee;
  if (callee.type === Syntax.Identifier) {
    if (callee.name === '$at') {
      return new expressions.ScopedModelExpression(args[0]);
    }
    return new Constructor([callee.name], args, afterSegments);
  } else if (callee.type === Syntax.MemberExpression) {
    const segments = reduceMemberExpression(callee).segments;
    return new Constructor(segments, args, afterSegments);
  } else {
    unexpected(node);
  }
}

function reduceLiteral(node: estree.Literal) {
  return new expressions.LiteralExpression(node.value);
}

function reduceUnaryExpression(node: estree.UnaryExpression) {
  // `-` and `+` can be either unary or binary, so all unary operators are
  // postfixed with `U` to differentiate
  const operator = node.operator + 'U';
  const expression = reduce(node.argument);
  if (expression instanceof expressions.LiteralExpression) {
    const fn = operatorFns.get[operator];
    expression.value = fn(expression.value);
    return expression;
  }
  return new expressions.OperatorExpression(operator, [expression]);
}

function reduceBinaryExpression(node: estree.BinaryExpression) {
  const operator = node.operator;
  const left = reduce(node.left);
  const right = reduce(node.right);
  if (
    left instanceof expressions.LiteralExpression &&
    right instanceof expressions.LiteralExpression
  ) {
    const fn = operatorFns.get[operator];
    const value = fn(left.value, right.value);
    return new expressions.LiteralExpression(value);
  }
  return new expressions.OperatorExpression(operator, [left, right]);
}

function reduceConditionalExpression(node: estree.ConditionalExpression) {
  const test = reduce(node.test);
  const consequent = reduce(node.consequent);
  const alternate = reduce(node.alternate);
  if (
    test instanceof expressions.LiteralExpression &&
    consequent instanceof expressions.LiteralExpression &&
    alternate instanceof expressions.LiteralExpression
  ) {
    const value = (test.value) ? consequent.value : alternate.value;
    return new expressions.LiteralExpression(value);
  }
  return new expressions.OperatorExpression('?', [test, consequent, alternate]);
}

function reduceArrayExpression(node: estree.ArrayExpression) {
  const literal = [];
  const items = [];
  let isLiteral = true;
  for (let i = 0; i < node.elements.length; i++) {
    const expression = reduce(node.elements[i]);
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

function isProperty(property: estree.Property | estree.SpreadElement): property is estree.Property {
  return (property as estree.Property).type === Syntax.Property;
}

function reduceObjectExpression(node: estree.ObjectExpression) {
  const literal = {};
  const properties = {};
  let isLiteral = true;
  for (let i = 0; i < node.properties.length; i++) {
    const property = node.properties[i];
    if (isProperty(property)) {
      const key = getKeyName(property.key);
      const expression = reduce(property.value);
      properties[key] = expression;
      if (isLiteral && expression instanceof expressions.LiteralExpression) {
        literal[key] = expression.value;
      } else {
        isLiteral = false;
      }
    } else {
      // actually a estree.SpreadElement and not supported
      unexpected(node);
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literal) :
    new expressions.ObjectExpression(properties);
}

function getKeyName(node): string {
  return (node.type === Syntax.Identifier) ? node.name :
    (node.type === Syntax.Literal) ? node.value :
      unexpected(node);
}

function reduceSequenceExpression(node: estree.SequenceExpression, afterSegments?: string[]) {
  // Note that sequence expressions are not reduced to a literal if they only
  // contain literals. There isn't any utility to such an expression, so it
  // isn't worth optimizing.
  //
  // The fact that expressions separated by commas always parse into a sequence
  // is relied upon in parsing template tags that have comma-separated
  // arguments following a keyword
  const args = node.expressions.map(reduce);
  return new expressions.SequenceExpression(args, afterSegments);
}

function unexpected(node: estree.Node) {
  throw new Error('Unexpected Esprima node: ' + JSON.stringify(node, null, 2));
}
