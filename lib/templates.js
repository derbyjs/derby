var saddle = require('saddle');
var htmlUtil = require('html-util');

module.exports = {
  createTemplate: createTemplate
}

function createTemplate(source) {
  var node = new ParseNode();
  htmlUtil.parse(source, {
    start: function(tag, tagName, attributes) {
      var attributesMap, element;
      for (var key in attributes) {
        if (!attributesMap) attributesMap = new saddle.AttributesMap();
        attributesMap[key] = new saddle.Attribute(attributes[key]);
      }
      if (saddle.VOID_ELEMENTS[tagName]) {
        element = new saddle.Element(tagName, attributesMap);
        node.content.push(element);
      } else {
        node = node.child();
        element = new saddle.Element(tagName, attributesMap, node.content);
        node.parent.content.push(element);
      }
    }
  , end: function(tag, tagName) {
      node = node.parent;
    }
  , text: function(data) {
      var text = new saddle.Text(data);
      node.content.push(text);
    }
  , comment: function(tag, data) {
      // Only output comments that start with `<!--[` and end with `]-->`
      if (!htmlUtil.isConditionalComment(tag)) return;
      var comment = new saddle.Comment(data);
      node.content.push(comment);
    }
  });
  return new saddle.Template(node.content);
}

function ParseNode(parent) {
  this.parent = parent;
  this.content = [];
}
ParseNode.prototype.child = function() {
  return new ParseNode(this);
};

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
