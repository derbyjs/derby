var expect = require('chai').expect;
var pathLib = require('node:path');
const { Component } = require('../../src/components');
var domTestRunner = require('../../src/test-utils/domTestRunner');

describe('components', function() {
  var runner = domTestRunner.install();

  describe('app.component registration', function() {
    describe('passing just component class', function() {
      describe('with static view prop', function() {
        it('external view file', function() {
          var harness = runner.createHarness();

          function SimpleBox() {}
          SimpleBox.view = {
            is: 'simple-box',
            // Static `view.file` property, defining path of view file
            file: pathLib.resolve(__dirname, '../fixtures/simple-box')
          };
          harness.app.component(SimpleBox);

          harness.setup('<view is="simple-box"/>');
          expect(harness.renderHtml().html).to.equal('<div class="simple-box"></div>');
        });

        it('inlined view.source', function() {
          var harness = runner.createHarness();

          function SimpleBox() {}
          SimpleBox.view = {
            is: 'simple-box',
            source: '<index:><div>Inlined source</div>'
          };
          harness.app.component(SimpleBox);

          harness.setup('<view is="simple-box"/>');
          expect(harness.renderHtml().html).to.equal('<div>Inlined source</div>');
        });

        it('inferred view file from view name', function() {
          var harness = runner.createHarness();

          // Pre-load view with same name as the component's static `view.is`
          harness.app.loadViews(pathLib.resolve(__dirname, '../fixtures/simple-box'), 'simple-box');

          function SimpleBox() {}
          SimpleBox.view = {
            is: 'simple-box'
          };
          harness.app.component(SimpleBox);

          harness.setup('<view is="simple-box"/>');
          expect(harness.renderHtml().html).to.equal('<div class="simple-box"></div>');
        });
      });
    });

    it('throws error if registering a singleton component that extends Component', () => {
      const harness = runner.createHarness();

      class MySingletonComponent extends Component {
      }
      MySingletonComponent.view = {
        is: 'my-singleton-component',
        source: '<index:><div>My singleton</div>'
      };
      MySingletonComponent.singleton = true;
      expect(() => {
        harness.app.component(MySingletonComponent);
      }).to.throw(Error, 'Singleton compoment must not extend the Component class');
    });
  });

  describe('singleton components', () => {
    it('do not have their own model when rendered', () => {
      const harness = runner.createHarness();

      class MySingletonComponent {
      }
      MySingletonComponent.view = {
        is: 'my-singleton-component',
        source: '<index:><div>{{@greeting}}</div>'
      };
      MySingletonComponent.singleton = true;
      harness.app.component(MySingletonComponent);

      harness.setup('<view is="my-singleton-component" greeting="{{_page.greeting}}"/>');
      harness.model.set('_page.greeting', 'Hello');

      const renderResult = harness.renderHtml();
      expect(renderResult.html).to.equal('<div>Hello</div>');
      // No Component instance created for singleton components
      expect(renderResult.component).to.equal(undefined);
      // Singleton components don't get a model allocated under '$components.' like
      // normal components would.
      expect(harness.model.get('$components')).to.equal(undefined);
    });

    it('can call view functions defined on the component class', () => {
      const harness = runner.createHarness();

      class MySingletonComponent {
        emphasize(text) {
          return text ? text.toUpperCase() : '';
        }
      }
      MySingletonComponent.view = {
        is: 'my-singleton-component',
        source: '<index:><div>{{emphasize(@greeting)}}</div>'
      };
      MySingletonComponent.singleton = true;
      harness.app.component(MySingletonComponent);

      harness.setup('<view is="my-singleton-component" greeting="Hello"/>');

      const renderResult = harness.renderHtml();
      expect(renderResult.html).to.equal('<div>HELLO</div>');
    });
  });
});
