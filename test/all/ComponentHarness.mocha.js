var expect = require('chai').expect;
var testUtils = require('../../test-utils');
var ComponentHarness = testUtils.ComponentHarness;

describe('ComponentHarness', function() {
  describe('getInstance', function() {
    it('creates a component instance', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var box = new ComponentHarness('<view is="box" />', Box).getInstance();
      expect(box).instanceof(Box);
    });
    it('Can pass a value to a component instance from harness template', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var box = new ComponentHarness('<view is="box" value="Hi" />', Box).getInstance();
      expect(box.model.get('value')).equal('Hi');
    });
    it('Can pass a value to a component instance from harness model', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var harness = new ComponentHarness('<view is="box" value="{{_page.message}}" />', Box);
      harness.model.set('_page.message', 'Yo.');
      var box = harness.getInstance();
      expect(box.model.get('value')).equal('Yo.');
    });
  });

  describe('getHtml', function() {
    it('Returns HTML', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<div class="box"></div>'
      };
      var html = new ComponentHarness('<view is="box" />', Box).getHtml();
      expect(html).equal('<div class="box"></div>');
    });
  });

  describe('getFragment', function() {
    if (typeof document === 'undefined') return;

    it('Returns a DocumentFragment', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<div class="box"></div>'
      };
      var fragment = new ComponentHarness('<view is="box" />', Box).getFragment();
      expect(fragment).instanceof(DocumentFragment);
      expect(fragment).html('<div class="box"></div>');
    });
  });
});
