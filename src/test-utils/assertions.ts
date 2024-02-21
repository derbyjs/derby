import { ComponentHarness } from './ComponentHarness';

/**
 * @param { {window: Window } } [dom] - _optional_ - An object that will have a `window` property
 *   set during test execution. If not provided, the global `window` will be used.
 * @param {Assertion} [chai.Assertion] - _optional_ - Chai's Assertion class. If provided, the
 *   chainable expect methods `#html(expected)` and `#render(expected)` will be added to Chai.
 */
export function assertions(dom, Assertion) {
  const getWindow = dom ?
    function() { return dom.window; } :
    function() { return window; };

  function removeComments(node) {
    const domDocument = getWindow().document;
    const clone = domDocument.importNode(node, true);
    // last two arguments for createTreeWalker are required in IE
    // NodeFilter.SHOW_COMMENT === 128
    const treeWalker = domDocument.createTreeWalker(clone, 128, null, false);
    const toRemove = [];
    for (let item = treeWalker.nextNode(); item != null; item = treeWalker.nextNode()) {
      toRemove.push(item);
    }
    for (let i = toRemove.length; i--;) {
      toRemove[i].parentNode.removeChild(toRemove[i]);
    }
    return clone;
  }

  function getHtml(node, parentTag) {
    const domDocument = getWindow().document;
    // We use the <ins> element, because it has a transparent content model:
    // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Transparent_content_model
    //
    // In practice, DOM validity isn't enforced by browsers when using
    // appendChild and innerHTML, so specifying a valid parentTag for the node
    // should not be necessary
    const el = domDocument.createElement(parentTag || 'ins');
    const clone = domDocument.importNode(node, true);
    el.appendChild(clone);
    return el.innerHTML;
  }

  // Executes the parts of `Page#destroy` pertaining to the model, which get
  // re-done when a new Page gets created on the same model. Normally, using
  // `Page#destroy` would be fine, but the `.to.render` assertion wants to do
  // 3 rendering passes on the same data, so we can't completely clear the
  // model's state between the rendering passes.
  function resetPageModel(page) {
    page._removeModelListeners();
    for (const componentId in page._components) {
      const component = page._components[componentId];
      component.destroy();
    }
    page.model.silent().destroy('$components');
  }

  if (Assertion) {
    Assertion.addMethod('html', function(expected, options) {
      const obj = this._obj;
      const includeComments = options && options.includeComments;
      const parentTag = options && options.parentTag;
      const domNode = getWindow().Node;

      new Assertion(obj).instanceOf(domNode);
      new Assertion(expected).is.a('string');

      const fragment = (includeComments) ? obj : removeComments(obj);
      const html = getHtml(fragment, parentTag);

      this.assert(
        html === expected,
        'expected DOM rendering to produce the HTML #{exp} but got #{act}',
        'expected DOM rendering to not produce actual HTML #{act}',
        expected,
        html
      );
    });

    Assertion.addMethod('render', function(expected, options) {
      const harness = this._obj;
      if (expected && typeof expected === 'object') {
        options = expected;
        expected = null;
      }
      const domDocument = getWindow().document;
      const parentTag = (options && options.parentTag) || 'ins';
      let firstFailureMessage, actual;

      new Assertion(harness).instanceOf(ComponentHarness);

      // Render to a HTML string.
      let renderResult = harness.renderHtml(options);
      const htmlString = renderResult.html;

      // Normalize `htmlString` into the same form as the DOM would give for `element.innerHTML`.
      //
      // derby-parsing uses htmlUtil.unescapeEntities(source) on text nodes' content. That converts
      // HTML entities like '&nbsp;' to their corresponding Unicode characters. However, for this
      // assertion, if the `expected` string is provided, it will not have that same transformation.
      // To make the assertion work properly, normalize the actual `htmlString`.
      const html = normalizeHtml(htmlString);

      let htmlRenderingOk;
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

      resetPageModel(renderResult.page);

      // Check DOM rendering is also equivalent.
      // This uses the harness "pageRendered" event to grab the rendered DOM *before* any component
      // `create()` methods are called, as `create()` methods can do DOM mutations.
      let domRenderingOk;
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
      renderResult = harness.renderDom(options);
      resetPageModel(renderResult.page);

      // Try attaching. Attachment will throw an error if HTML doesn't match
      const el = domDocument.createElement(parentTag);
      el.innerHTML = htmlString;
      const innerHTML = el.innerHTML;
      let attachError;
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
      const attachOk = !attachError;

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
    const normalizeHtml = function(html) {
      const normalizerElement = window.document.createElement('ins');
      normalizerElement.innerHTML = html;
      return normalizerElement.innerHTML;
    };
  }

  return {
    removeComments: removeComments,
    getHtml: getHtml
  };
}
