var saddle = require('saddle');
var htmlUtil = require('html-util');
var expressions = require('./expressions');
var createPathExpression = require('./createPathExpression');

module.exports = {
  createTemplate: createTemplate
, createExpression: createExpression
}

// Modified and shared among the following parse functions
var parseNode;

function createTemplate(source) {
  parseNode = new ParseNode();
  htmlUtil.parse(source, {
    start: parseHtmlStart
  , end: parseHtmlEnd
  , text: parseHtmlText
  , comment: parseHtmlComment
  });
  return new saddle.Template(parseNode.content);
}

function parseHtmlStart(tag, tagName, attributes) {
  var attributesMap = parseAttributes(attributes);
  var element;
  if (saddle.VOID_ELEMENTS[tagName]) {
    element = new saddle.Element(tagName, attributesMap);
    parseNode.content.push(element);
  } else {
    parseNode = parseNode.child();
    element = new saddle.Element(tagName, attributesMap, parseNode.content);
    parseNode.parent.content.push(element);
  }
}

function parseAttributes(attributes) {
  var attributesMap;
  for (var key in attributes) {
    if (!attributesMap) attributesMap = new saddle.AttributesMap();
    parseNode = parseNode.child();

    var value = attributes[key];
    if (value === '' || typeof value !== 'string') {
      attributesMap[key] = new saddle.Attribute(value);
      continue;
    }
    parseText(value, parseTextLiteral, parseTextExpression);

    if (parseNode.content.length === 1) {
      var item = parseNode.content[0];
      attributesMap[key] = (item instanceof saddle.Text) ?
        new saddle.Attribute(item.data) :
        new saddle.DynamicAttribute(item);

    } else if (parseNode.content.length > 1) {
      var template = new saddle.Template(parseNode.content);
      attributesMap[key] = new saddle.DynamicAttribute(template);

    } else {
      throw new Error('Error parsing ' + key + ' attribute: ' + value);
    }

    parseNode = parseNode.parent;
  }
  return attributesMap;
}

function parseHtmlEnd(tag, tagName) {
  parseNode = parseNode.parent;
}

function parseHtmlText(data) {
  parseText(data, parseTextLiteral, parseTextExpression);
}

function parseHtmlComment(tag, data) {
  // Only output comments that start with `<!--[` and end with `]-->`
  if (!htmlUtil.isConditionalComment(tag)) return;
  var comment = new saddle.Comment(data);
  parseNode.content.push(comment);
}

function parseTextLiteral(data) {
  var text = new saddle.Text(data);
  parseNode.content.push(text);
}

function parseTextExpression(expression) {
  var blockType = expression.meta.blockType;
  if (!blockType) return parseTextValueExpression(expression);

  // Ending block
  if (blockType === 'end') {
    // TODO: Error checking
    parseNode = parseNode.parent;

  // Continuing block
  } else if (blockType === 'else' || blockType === 'else if') {
    parseNode = parseNode.parent;
    var last = parseNode.last();
    parseNode = parseNode.child();

    if (last instanceof saddle.ConditionalBlock) {
      last.expressions.push(expression);
      last.contents.push(parseNode.content);
    } else if (last instanceof saddle.EachBlock) {
      if (blockType !== 'else') unexpected(expression.source);
      last.elseContent = parseNode.content;
    } else {
      unexpected(expression.source);
    }

  // Starting block
  } else {
    var nextNode = parseNode.child();
    var block;
    if (blockType === 'if' || blockType === 'unless') {
      block = new saddle.ConditionalBlock([expression], [nextNode.content]);
    } else if (blockType === 'each') {
      block = new saddle.EachBlock(expression, nextNode.content);
    } else {
      block = new saddle.Block(expression, nextNode.content);
    }
    parseNode.content.push(block);
    parseNode = nextNode;
  }
}

function parseTextValueExpression(expression) {
  var text = new saddle.DynamicText(expression);
  parseNode.content.push(text);
}

function ParseNode(parent) {
  this.parent = parent;
  this.content = [];
}
ParseNode.prototype.child = function() {
  return new ParseNode(this);
};
ParseNode.prototype.last = function() {
  return this.content[this.content.length - 1];
};

function parseText(data, onLiteral, onExpression) {
  var current = data;
  var last;
  while (current) {
    if (current === last) throw new Error('Error parsing template text: ' + data);
    last = current;

    var start = current.indexOf('{{');
    if (start === -1) {
      onLiteral(current);
      return;
    }

    var end = matchBraces(current, 2, start, '{', '}');
    if (end === -1) throw new Error('Mismatched braces in: ' + data);

    if (start > 0) {
      var before = current.slice(0, start);
      onLiteral(current.slice(0, start));
    }

    var inside = current.slice(start + 2, end - 2);
    if (inside) {
      var expression = createExpression(inside);
      onExpression(expression);
    }

    current = current.slice(end);
  }
}

function matchBraces(text, num, i, openChar, closeChar) {
  i += num;
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

var blockRegExp = /^(if|unless|else if|each|with)\s+([\s\S]+?)(?:\s+as\s+(\S+))?$/;
var valueRegExp = /^(?:(unbound|bound|unescaped)\s+)?([\s\S]*)/;

function createExpression(source) {
  source = source.trim();
  var meta = new expressions.ExpressionMeta(source);

  // Parse block expression
  // 
  // The block expressions `if`, `unless`, `else if`, `each`, and `with` must
  // have a single blockType keyword and a path. They may have an optional
  // alias assignment. The blocks `else`, `unbound`, and `bound` may not have
  // a path or alias.
  var match = blockRegExp.exec(source);
  var path;
  if (match) {
    meta.blockType = match[1];
    path = match[2];
    meta.as = match[3];

  } else if (source === 'else' || source === 'unbound' || source === 'bound') {
    meta.blockType = source;

  } else if (source.charAt(0) === '/') {
    meta.blockType = 'end';

  // Parse value expression
  // 
  // A value expression can have zero or many keywords
  } else {
    path = source;
    do {
      match = valueRegExp.exec(path);
      var keyword = match[1];
      path = match[2];
      if (keyword === 'unescaped') {
        meta.unescaped = true;
      } else if (keyword === 'unbound' || keyword === 'bound') {
        meta.bindType = keyword;
      }
    } while (keyword);
  }

  var expression = (path) ? createPathExpression(path) : new expressions.Expression();
  expression.meta = meta;
  return expression;
}

function unexpected(source) {
  throw new Error('Error parsing template: ' + source);
}
