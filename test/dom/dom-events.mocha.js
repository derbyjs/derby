var expect = require('chai').expect;
var domTestRunner = require('../../src/test-utils/domTestRunner');

describe('DOM events', function() {
  const runner = domTestRunner.install();

  it('HTML element markup custom `create` event', function() {
    const { app } = runner.createHarness();
    app.views.register('Body',
      '<div on-create="createDiv($element)">' +
        '<span on-create="createSpan($element)"></span>' +
      '</div>'
    );
    var page = app.createPage();
    var div, span;
    page.createDiv = function(element) {
      div = element;
    };
    page.createSpan = function(element) {
      span = element;
    };
    var fragment = page.getFragment('Body');
    expect(fragment).html('<div><span></span></div>');
    expect(div).html('<div><span></span></div>');
    expect(span).html('<span></span>');
  });

  it.skip('HTML element markup custom `destroy` event', function() {
    const { app } = runner.createHarness();
    app.views.register('Body',
      '<div>' +
        '{{unless _page.hide}}' +
          '<span on-destroy="destroySpan($element)"></span>' +
        '{{/unless}}' +
      '</div>'
    );
    var page = app.createPage();
    var span;
    page.destroySpan = function(element) {
      span = element;
    };
    var fragment = page.getFragment('Body');
    expect(fragment).html('<div><span></span></div>');
    expect(span).equal(undefined);

    page.model.set('_page.hide', true);
    expect(fragment).html('<div></div>');
    expect(span).html('<span></span>');
  });

  it('dom.on custom `destroy` event', function() {
    const { app } = runner.createHarness();
    app.views.register('Body',
      '<div>' +
        '{{unless _page.hide}}' +
          '<span as="span"></span>' +
        '{{/unless}}' +
      '</div>'
    );
    var page = app.createPage();
    var fragment = page.getFragment('Body');
    var destroyed = false;
    page.dom.on('destroy', page.span, function() {
      destroyed = true;
    });
    expect(fragment).html('<div><span></span></div>');
    expect(destroyed).equal(false);

    page.model.set('_page.hide', true);
    expect(fragment).html('<div></div>');
    expect(destroyed).equal(true);
  });
});
