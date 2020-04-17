var ComponentHarness = require('./ComponentHarness');

/**
 * @param { {window: Window } } [dom] - _optional_ - An object that will have a `window` property
 *   set during test execution. If not provided, the global `window` will be used.
 * @param {Assertion} [chai.Assertion] - _optional_ - Chai's Assertion class. If provided, the
 *   chainable expect methods `#html(expected)` and `#render(expected)` will be added to Chai.
 */
module.exports = function(dom, Assertion) {
  var getWindow = dom ?
    function() { return dom.window; } :
    function() { return window; };

  function removeComments(node) {
    var domDocument = getWindow().document;
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
    var domDocument = getWindow().document;
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
      var domNode = getWindow().Node;

      new Assertion(obj).instanceOf(domNode);
      new Assertion(expected).is.a('string');

      var fragment = (includeComments) ? obj : removeComments(obj);
      var html = getHtml(fragment, parentTag);

      this.assert(
        html === expected,
        'expected DOM rendering to produce the HTML #{exp} but got #{act}',
        'expected DOM rendering to not produce actual HTML #{act}',
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
      var domDocument = getWindow().document;
      var parentTag = (options && options.parentTag) || 'ins';
      var firstFailureMessage, actual;

      new Assertion(harness).instanceOf(ComponentHarness);

      // Render to a HTML string.
      var htmlString = harness.renderHtml(options).html;

      // Normalize `htmlString` into the same form as the DOM would give for `element.innerHTML`.
      //
      // derby-parsing uses htmlUtil.unescapeEntities(source) on text nodes' content. That converts
      // HTML entities like '&nbsp;' to their corresponding Unicode characters. However, for this
      // assertion, if the `expected` string is provided, it will not have that same transformation.
      // To make the assertion work properly, normalize the actual `htmlString`.
      var html = normalizeHtml(htmlString);

      var htmlRenderingOk;
      if (expected == null) {
        // If `expected` is not provided, then we skip this check.
        // Set `expected` as the normalized HTML string for subsequent checks.
        expected = html;
        htmlRenderingOk = true;
      } else {
        // If `expected` was originally provided, check that the normalized HTML string is equal.
        new Assertion(expected).is.a('string');
        // Check HTML matches expected value
        htmlRenderingOk = html === expected;
        if (!htmlRenderingOk) {
          if (!firstFailureMessage) {
            firstFailureMessage = 'HTML string rendering does not match expected HTML';
            actual = html;
          }
        }
      }

      // Check DOM rendering is also equivalent.
      // This uses the harness "pageRendered" event to grab the rendered DOM *before* any component
      // `create()` methods are called, as `create()` methods can do DOM mutations.
      var domRenderingOk;
      harness.once('pageRendered', function(page) {
        try {
          new Assertion(page.fragment).html(expected, options);
          domRenderingOk = true;
        } catch (err) {
          domRenderingOk = false;
          if (!firstFailureMessage) {
            firstFailureMessage = err.message;
            actual = err.actual;
          }
        }
      });
      harness.renderDom(options);

      // Try attaching. Attachment will throw an error if HTML doesn't match
      var el = domDocument.createElement(parentTag);
      el.innerHTML = htmlString;
      var innerHTML = el.innerHTML;
      var attachError;
      try {
        harness.attachTo(el);
      } catch (err) {
        attachError = err;
        if (!firstFailureMessage) {
          firstFailureMessage = 'expected success attaching to #{exp} but got #{act}.\n' +
            (attachError ? (attachError.message + attachError.stack) : '');
          actual = innerHTML;
        }
      }
      var attachOk = !attachError;

      // TODO: Would be nice to add a diff of the expected and actual HTML
      this.assert(
        htmlRenderingOk && domRenderingOk && attachOk,
        firstFailureMessage || 'rendering failed due to an unknown reason',
        'expected rendering to fail but it succeeded',
        expected,
        actual
      );
    });

    /**
     * Normalize a HTML string into its `innerHTML` form.
     *
     * WARNING - Only use this with trusted HTML, e.g. developer-provided HTML.
     *
     * Assigning into `element.innerHTML` does some interesting transformations:
     *
     * - Certain safe HTML entities like "&quot;" are converted into their unescaped
     *   single-character forms.
     * - Certain single characters, e.g. ">" or a non-breaking space, are converted
     *   into their escaped HTML entity forms, e.g. "&gt;" or "&nbsp;".
     */
    var normalizeHtml = function(html) {
      var normalizerElement = window.document.createElement('ins');
      normalizerElement.innerHTML = html;
      return normalizerElement.innerHTML;
    };
  }

  return {
    removeComments: removeComments,
    getHtml: getHtml
  };
};
