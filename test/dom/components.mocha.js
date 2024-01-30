var expect = require('chai').expect;
var pathLib = require('node:path');
var domTestRunner = require('../../test-utils/domTestRunner');

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
  });
});
