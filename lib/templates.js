var saddle = require('saddle');
var htmlUtil = require('html-util');

module.exports = {
  createTemplate: createTemplate
}

function createTemplate(source) {
  var node = new ParseNode();
  htmlUtil.parse(source, {
    start: function(tag, tagName, attrs) {
      node = node.child();
      var element = new saddle.Element(tagName, null, node.content);
      node.parent.content.push(element);
    }
  , end: function(tag, tagName) {
      node = node.parent;
    }
  , text: function(text) {

    }
  , comment: function(tag, data) {

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
