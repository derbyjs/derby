var ComponentHarness = require('./ComponentHarness');

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
    // We use the <ins> element, because it has a transparent content model:
    // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Transparent_content_model
    //
    // In practice, DOM validity isn't enforced by browsers when using
    // appendChild and innerHTML, so specifying a valid parentTag for the node
    // should not be necessary
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

    Assertion.addMethod('render', function(expected, options) {
      var harness = this._obj;
      if (expected && typeof expected === 'object') {
        options = expected;
        expected = null;
      }
      var domDocument = (domWindow || window).document;
      var parentTag = (options && options.parentTag) || 'ins';

      new Assertion(harness).instanceOf(ComponentHarness);

      // Check HTML matches expected value
      var html = harness.renderHtml(options).html;
      // Use the HTML as the expected value if null. This allows the user to
      // test that all modes of rendering will be equivalent
      if (expected == null) expected = html;
      new Assertion(expected).is.a('string');
      new Assertion(html).equal(expected);

      // Check DOM rendering is also equivalent
      var fragment = harness.renderDom(options).fragment;
      new Assertion(fragment).html(expected, options);

      // Try attaching. Attachment will throw an error if HTML doesn't match
      var el = domDocument.createElement(parentTag);
      el.innerHTML = html;
      var innerHTML = el.innerHTML;
      var attachError;
      try {
        harness.attachTo(el);
      } catch (err) {
        attachError = err;
      }

      // TODO: Would be nice to add a diff of the expected and actual HTML
      this.assert(
        !attachError,
        'expected success attaching to #{exp} but got #{act}.\n' +
          (attachError && attachError.message),
        'expected render to fail but matched #{exp}',
        expected,
        innerHTML
      );
    });
  }

  return {
    removeComments: removeComments,
    getHtml: getHtml
  };
};
