var Component = require('../../lib/components').Component;
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

    it('will update fragments dynamically', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box {{if open}}open{{/if}}"></div>'
      };
      var page = new ComponentHarness('<view is="box" />', Box).renderDom();
      var fragment = page.fragment;
      var component = page.component;
      expect(fragment).html('<div class="box "></div>');
      component.model.set('open', true);
      expect(fragment).html('<div class="box open"></div>');
    });

    it('will update nodes dynamically', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div as="container" class="box {{if open}}open{{/if}}"></div>'
      };
      var component = new ComponentHarness('<view is="box" />', Box).renderDom().component;
      var container = component.container;
      expect(container.className).equal('box ');
      component.model.set('open', true);
      expect(container.className).equal('box open');
    });

    it('removes reference to stub components on destroy', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '{{unless hideClown}}' +
                '<view is="clown" />' +
              '{{/unless}}' +
            '</div>'
      };
      var page = new ComponentHarness('<view is="box" />', Box)
        .stubComponent('clown').renderDom();
      var model = page.component.model;
      expect(page.clown).instanceof(Component);
      model.set('hideClown', true);
      expect(page.clown).equal(undefined);
      model.set('hideClown', false);
      expect(page.clown).instanceof(Component);
    });

    it('removes stub components from array on destroy', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '{{if showHappy}}' +
                '<view is="clown" expression="happy" />' +
              '{{/if}}' +
              '{{if showSad}}' +
                '<view is="clown" expression="sad" />' +
              '{{/if}}' +
            '</div>'
      };
      var page = new ComponentHarness('<view is="box" show-happy />', Box)
        .stubComponent({is: 'clown', asArray: 'clowns'}).renderDom();
      var clowns = page.clowns;
      var model = page.component.model;
      expect(clowns.length).equal(1);
      expect(clowns[0].model.get('expression')).equal('happy');
      model.set('showSad', true);
      expect(clowns.length).equal(2);
      expect(clowns[0].model.get('expression')).equal('happy');
      expect(clowns[1].model.get('expression')).equal('sad');
      model.set('showHappy', false);
      expect(clowns.length).equal(1);
      expect(clowns[0].model.get('expression')).equal('sad');
      model.set('showSad', false);
      expect(clowns.length).equal(0);
    });
  });

  describe('render assertion', function() {
    if (typeof document === 'undefined') return;

    it('checks equivalence of HTML, DOM, and attachment rendering', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      var harness = new ComponentHarness('<view is="box" />', Box);
      expect(harness).to.render();
    });

    it('fails because of non-equivalent invalid HTML', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><p><div></div></p>'
      };
      var harness = new ComponentHarness('<view is="box" />', Box);
      expect(harness).not.to.render();
    });

    it('fails because of non-equivalent optional HTML element', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><table><tr><td></td></tr></table>'
      };
      var harness = new ComponentHarness('<view is="box" />', Box);
      expect(harness).not.to.render();
    });

    it('checks harness HTML, DOM, and attachment rendering against html', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      var harness = new ComponentHarness('<view is="box" />', Box);
      expect(harness).to.render('<div class="box"></div>');
    });

    it('fails to attach due to invalid HTML', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><p><div></div></p>'
      };
      var harness = new ComponentHarness('<view is="box" />', Box);
      expect(harness).not.to.render('<p><div></div></p>');
    });

    it('passes with blank view', function() {
      function Box() {}
      Box.view = {is: 'box'};
      var harness = new ComponentHarness('<view is="box" />', Box);
      expect(harness).to.render('');
    });
  });

  describe('setup', function() {
    it('can be called after instantiation to configure a harness', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      var harness = new ComponentHarness();
      var html = harness.setup('<view is="box" />', Box).renderHtml().html;
      expect(html).equal('<div class="box"></div>');
    });
  });

  describe('dependencies', function() {
    it('registers component dependencies', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      var html = new ComponentHarness('<view is="box" />', Box).renderHtml().html;
      expect(html).equal('<div class="box"><div class="clown"></div></div>');
    });

    it('can specify custom name for a dependency', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="my-precious" />' +
            '</div>',
        dependencies: [
          ['my-precious', Clown]
        ]
      };
      var html = new ComponentHarness('<view is="box" />', Box).renderHtml().html;
      expect(html).equal('<div class="box"><div class="clown"></div></div>');
    });

    it('throws error when overriding a view', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      var harness = new ComponentHarness('<view is="box" />');
      harness.app.views.register('clown', '');
      expect(function() {
        harness.app.component(Box);
      }).to.throw(Error);
    });

    it('throws error when overriding a component', function() {
      function ConflictingClown() {}
      ConflictingClown.view = {is: 'clown'};
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      expect(function() {
        new ComponentHarness('<view is="box" />', ConflictingClown, Box);
      }).to.throw(Error);
    });

    it('gets overridden without error', function() {
      function ConflictingClown() {}
      ConflictingClown.view = {is: 'clown'};
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      var html = new ComponentHarness(
        '<view is="box" />', Box, ConflictingClown
      ).renderHtml().html;
      expect(html).equal('<div class="box"></div>');
    });

    it('allows two components to share a dependency', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      function Car() {}
      Car.view = {
        is: 'car',
        source:
          '<index:>' +
            '<div class="car">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };

      var html = new ComponentHarness(
        '<view is="box" /><view is="car" />', Box, Car
      ).renderHtml().html;
      expect(html).equal(
        '<div class="box"><div class="clown"></div></div>' +
        '<div class="car"><div class="clown"></div></div>'
      );
    });

    it('handles circular dependencies', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>' +
            '<view is="box" clownless />',
        dependencies: [Box]
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '{{unless clownless}}<view is="clown" />{{/unless}}' +
            '</div>',
        dependencies: [Clown]
      };
      var html = new ComponentHarness('<view is="box" />', Box).renderHtml().html;
      expect(html).equal('<div class="box"><div class="clown"></div><div class="box"></div></div>');
    });

    it('overrides component dependency with custom mock', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      function ClownMock() {}
      ClownMock.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown mock"></div>'
      };
      var html = new ComponentHarness('<view is="box" />', Box, ClownMock).renderHtml().html;
      expect(html).equal('<div class="box"><div class="clown mock"></div></div>');
    });
  });

  describe('stub', function() {
    it('defines empty views by name', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
              '<view is="ball" />' +
              '<view is="puppy" />' +
            '</div>'
      };
      var html = new ComponentHarness('<view is="box" />', Box)
        .stub('clown', 'ball', 'puppy').renderHtml().html;
      expect(html).equal('<div class="box"></div>');
    });

    it('overrides a component dependency with an empty view', function() {
      function Clown() {}
      Clown.view = {
        is: 'clown',
        source:
          '<index:>' +
            '<div class="clown"></div>'
      };
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" />' +
            '</div>',
        dependencies: [Clown]
      };
      var html = new ComponentHarness('<view is="box" />', Box)
        .stub('clown').renderHtml().html;
      expect(html).equal('<div class="box"></div>');
    });
  });

  describe('stubComponent', function() {
    it('defines an empty view and creates a property on page by name', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" expression="happy" />' +
              '<view is="ball" type="bouncy" />' +
            '</div>'
      };
      var page = new ComponentHarness('<view is="box" />', Box)
        .stubComponent('clown', 'ball').renderHtml();
      expect(page.html).equal('<div class="box"></div>');
      expect(page.clown.model.get('expression')).equal('happy');
      expect(page.ball.model.get('type')).equal('bouncy');
    });

    it('supports `as` option', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" expression="happy" />' +
            '</div>'
      };
      var page = new ComponentHarness('<view is="box" />', Box)
        .stubComponent({is: 'clown', as: 'myClown'}).renderHtml();
      expect(page.html).equal('<div class="box"></div>');
      expect(page.myClown.model.get('expression')).equal('happy');
    });

    it('supports `asArray` option', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" expression="happy" />' +
              '<view is="clown" expression="sad" />' +
            '</div>'
      };
      var page = new ComponentHarness('<view is="box" />', Box)
        .stubComponent({is: 'clown', asArray: 'clowns'}).renderHtml();
      expect(page.html).equal('<div class="box"></div>');
      expect(page.clowns.length).equal(2);
      expect(page.clowns[0].model.get('expression')).equal('happy');
      expect(page.clowns[1].model.get('expression')).equal('sad');
    });

    it('can be created via static createStubComponent() method', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" expression="happy" />' +
            '</div>'
      };
      var ClownStub = ComponentHarness.createStubComponent({is: 'clown'});
      var page = new ComponentHarness('<view is="box" />', Box, ClownStub).renderHtml();
      expect(page.html).equal('<div class="box"></div>');
      expect(page.clown.model.get('expression')).equal('happy');
    });

    it('can supply options to createStubComponent() method', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" expression="happy" />' +
            '</div>'
      };
      var ClownStub = ComponentHarness.createStubComponent({is: 'clown', as: 'myClown'});
      var page = new ComponentHarness('<view is="box" />', Box, ClownStub).renderHtml();
      expect(page.html).equal('<div class="box"></div>');
      expect(page.myClown.model.get('expression')).equal('happy');
    });

    it('can supply source to createStubComponent() method', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source:
          '<index:>' +
            '<div class="box">' +
              '<view is="clown" expression="happy" />' +
            '</div>'
      };
      var ClownStub = ComponentHarness.createStubComponent({
        is: 'clown',
        source: '<index:><div class="stub clown"></div>'
      });
      var page = new ComponentHarness('<view is="box" />', Box, ClownStub).renderHtml();
      expect(page.html).equal('<div class="box"><div class="stub clown"></div></div>');
      expect(page.clown.model.get('expression')).equal('happy');
    });
  });
});
