var expressions = require('./expressions');
var createPathExpression = require('./createPathExpression');

module.exports = createExpression;

var blockRegExp = /^\s*(if|unless|else if|else|each|with)(?:\s+([\s\S]+?))?(?:\s+as\s+(\S+)\s*)?$/;
var valueRegExp = /^\s*(?:(unescaped)\s+)?([\s\S]*)/;

function createExpression(source) {
  var meta = new expressions.ExpressionMeta(source);

  // Parse block expression
  var match = blockRegExp.exec(source);
  var path;
  if (match) {
    meta.blockType = match[1];
    path = match[2];
    meta.as = match[3];

  // Parse value expression
  } else {
    match = valueRegExp.exec(source);
    if (match[1] === 'unescaped') {
      meta.unescaped = true;
    }
    path = match[2];
  }

  expression = (path) ? createPathExpression(path) : new expressions.Expression();
  expression.meta = meta;
  return expression;
}
