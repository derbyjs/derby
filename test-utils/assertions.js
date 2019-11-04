module.exports = function(domWindow, Assertion) {
  function removeComments(node) {
    var domDocument = (domWindow || window).document;
    var clone = domDocument.importNode(node, true);
    // last two arguments for createTreeWalker are required in IE
    // NodeFilter.SHOW_COMMENT === 128
    var treeWalker = domDocument.createTreeWalker(clone, 128, null, false);
    var toRemove = [];
    for (var item; item = treeWalker.nextNode();) {
      toRemove.push(item);
    }
    for (var i = toRemove.length; i--;) {
      toRemove[i].parentNode.removeChild(toRemove[i]);
    }
    return clone;
  }

  function getHtml(node, parentTag) {
    var domDocument = (domWindow || window).document;
    var el = domDocument.createElement(parentTag || 'ins');
    var clone = domDocument.importNode(node, true);
    el.appendChild(clone);
    return el.innerHTML;
  }

  if (Assertion) {
    Assertion.addMethod('html', function(expected, options) {
      var obj = this._obj;
      var includeComments = options && options.includeComments;
      var parentTag = options && options.parentTag;
      var domNode = (domWindow || window).Node;

      new Assertion(obj).instanceOf(domNode);
      new Assertion(expected).is.a('string');

      var fragment = (includeComments) ? obj : removeComments(obj);
      var html = getHtml(fragment, parentTag);

      this.assert(
        html === expected,
        'expected the HTML #{exp} but got #{act}',
        'expected to not have HTML #{act}',
        expected,
        html
      );
    });
  }

  return {
    removeComments: removeComments,
    getHtml: getHtml
  };
};
