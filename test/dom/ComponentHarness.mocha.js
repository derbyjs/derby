const expect = require('chai').expect;
const Component = require('../../src/components').Component;
const domTestRunner = require('../../src/test-utils/domTestRunner');

describe('ComponentHarness', function() {
  const runner = domTestRunner.install();

  describe('renderDom', function() {
    it('returns a page object', function() {
      function Box() {}
      Box.view = {is: 'box'};
      const harness = runner.createHarness('<view is="box" />', Box);
      const page = harness.renderDom();
      expect(page).instanceof(harness.app.Page);
    });

    it('sets component property on returned object', function() {
      function Box() {}
      Box.view = {is: 'box'};
      const box = runner.createHarness('<view is="box" />', Box).renderDom().component;
      expect(box).instanceof(Box);
    });

    it('sets fragment property on returned object', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      const fragment = runner.createHarness('<view is="box" />', Box).renderDom().fragment;
      expect(fragment).instanceof(runner.window.DocumentFragment);
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
      const box = runner.createHarness('<view is="box" />', Box, Clown).renderDom().component;
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
      const page = runner.createHarness('<view is="box" />', Box).renderDom();
      const fragment = page.fragment;
      const component = page.component;
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
      const component = runner.createHarness('<view is="box" />', Box).renderDom().component;
      const container = component.container;
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
      const page = runner.createHarness('<view is="box" />', Box)
        .stubComponent('clown').renderDom();
      const model = page.component.model;
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
      const page = runner.createHarness('<view is="box" show-happy />', Box)
        .stubComponent({is: 'clown', asArray: 'clowns'}).renderDom();
      const clowns = page.clowns;
      const model = page.component.model;
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
    it('checks equivalence of HTML, DOM, and attachment rendering', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).to.render();
    });

    it('fails because of non-equivalent invalid HTML', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><p><div></div></p>'
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).not.to.render();
    });

    it('fails because of non-equivalent optional HTML element', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><table><tr><td></td></tr></table>'
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).not.to.render();
    });

    it('checks harness HTML, DOM, and attachment rendering against html', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box"></div>'
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).to.render('<div class="box"></div>');
    });

    it('fails to attach due to invalid HTML', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><p><div></div></p>'
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).not.to.render('<p><div></div></p>');
    });

    it('passes with blank view', function() {
      function Box() {}
      Box.view = {is: 'box'};
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).to.render('');
    });

    it('ignores DOM mutations in components\' create()', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box" as="boxElement"></div>'
      };
      Box.prototype.create = function() {
        this.boxElement.className = 'box-changed-in-create';
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      expect(harness).to.render('<div class="box"></div>');
    });

    it('works with HTML entities like &nbsp;', function() {
      const harness = runner.createHarness('&lt;&nbsp;&quot;&gt;');
      expect(harness).to.render();
      expect(harness).to.render('&lt;&nbsp;"&gt;');
    });

    it('cleans up component state between render passes', function() {
      function Box() {}
      Box.view = {
        is: 'box',
        source: '<index:><div class="box">{{greeting}}</div>'
      };
      Box.prototype.init = function() {
        const initialName = this.model.scope('_page.initialName').get();
        expect(initialName).to.equal('Spot');
        this.model.set('name', initialName);
        this.model.start('greeting', ['name'], function(name) {
          // This assertion ensures that the reactive function isn't called after
          // the component gets destroyed.
          expect(name).to.equal('Spot');
          return 'Hello, ' + name;
        });
      };
      const harness = runner.createHarness('<view is="box" />', Box);
      // Have the test depend on state in `_page` to make sure it's not cleared
      // between rendering passes in `.to.render`.
      harness.model.set('_page.initialName', 'Spot');

      expect(harness).to.render('<div class="box">Hello, Spot</div>');
    });
  });

  describe('fake app.history implementation', function() {
    it('accepts url option', function() {
      const renderUrl = '/box?size=123';
      const expectedQueryParams = {size: '123'};

      const harness = runner.createHarness(
        'url: {{$render.url}} | query: {{JSON.stringify($render.query)}}'
      );
      const expectedHtml = 'url: /box?size=123 | query: {"size":"123"}';

      const page = harness.renderHtml({url: renderUrl});
      expectPageParams(page, renderUrl, expectedQueryParams);
      expect(page.html).to.equal(expectedHtml);

      page = harness.renderDom({url: renderUrl});
      expectPageParams(page, renderUrl, expectedQueryParams);
      expect(page.fragment).html(expectedHtml);
    });

    it('supports push(url) and replace(url)', function() {
      const harness = runner.createHarness(
        'url: {{$render.url}} | query: {{JSON.stringify($render.query)}}'
      );

      const page = harness.renderDom();
      expectPageParams(page, '', {});

      const newUrl = '/box?size=123';
      harness.app.history.push(newUrl);
      expectPageParams(page, newUrl, {size: '123'});
      expect(page.fragment).html('url: /box?size=123 | query: {"size":"123"}');

      newUrl = '/sphere?radius=456';
      harness.app.history.replace(newUrl);
      expectPageParams(page, newUrl, {radius: '456'});
      expect(page.fragment).html('url: /sphere?radius=456 | query: {"radius":"456"}');
    });
  });
});

function expectPageParams(page, expectedUrl, expectedQuery) {
  expect(page).to.have.property('params')
    .that.deep.includes({url: expectedUrl, query: expectedQuery});
}
