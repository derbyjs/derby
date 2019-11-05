var expect = require('chai').expect;
var ComponentHarness = require('../../test-utils').ComponentHarness;

describe('ComponentHarness', function() {
  describe('renderHtml', function() {
    it('returns a page object', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var harness = new ComponentHarness('<view is="box" />', Box);
      var page = harness.renderHtml();
      expect(page).instanceof(harness.app.Page);
    });

    it('sets component property on returned object', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var box = new ComponentHarness('<view is="box" />', Box).renderHtml().component;
      expect(box).instanceof(Box);
    });

    it('sets html property on returned object', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      var html = new ComponentHarness('<view is="box" />', Box).renderHtml().html;
      expect(html).equal('<div class="box"></div>');
    });

    it('passes a value to a component instance from harness template', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var box = new ComponentHarness('<view is="box" value="Hi" />', Box).renderHtml().component;
      expect(box.model.get('value')).equal('Hi');
    });

    it('passes a value to a component instance from harness model', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var harness = new ComponentHarness('<view is="box" value="{{_page.message}}" />', Box);
      harness.model.set('_page.message', 'Yo.');
      var box = harness.renderHtml().component;
      expect(box.model.get('value')).equal('Yo.');
    });

    it('renders view partials', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="peanuts" />' +
            '</div>' +
          '<peanuts:>' +
            '<div class="peanuts"></div>'
      };
      var html = new ComponentHarness('<view is="box" />', Box).renderHtml().html;
      expect(html).equal('<div class="box"><div class="peanuts"></div></div>');
    });

    it('renders child components', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>'
      };
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      var html = new ComponentHarness('<view is="box" />', Box, Clown).renderHtml().html;
      expect(html).equal('<div class="box"><div class="clown"></div></div>');
    });

    it('creates child component instances', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view on-init="initClown()" is="clown" />' +
            '</div>'
      };
      Box.prototype.initClown = function(clown) {
        this.myClown = clown;
      };
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      var box = new ComponentHarness('<view is="box" />', Box, Clown).renderHtml().component;
      expect(box.myClown).instanceof(Clown);
    });
  });

  describe('renderDom', function() {
    if (typeof document === 'undefined') return;

    it('returns a page object', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var harness = new ComponentHarness('<view is="box" />', Box);
      var page = harness.renderDom();
      expect(page).instanceof(harness.app.Page);
    });

    it('sets component property on returned object', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var box = new ComponentHarness('<view is="box" />', Box).renderDom().component;
      expect(box).instanceof(Box);
    });

    it('sets fragment property on returned object', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      var fragment = new ComponentHarness('<view is="box" />', Box).renderDom().fragment;
      expect(fragment).instanceof(DocumentFragment);
      expect(fragment).html('<div class="box"></div>');
    });

    it('creates child component instances', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view as="myClown" is="clown" />' +
            '</div>'
      };
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      var box = new ComponentHarness('<view is="box" />', Box, Clown).renderDom().component;
      expect(box.myClown).instanceof(Clown);
    });
  });
});
