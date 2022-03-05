var expect = require('chai').expect;
var domTestRunner = require('../../test-utils/domTestRunner');

describe('bindings', function() {
  var runner = domTestRunner.install();

  describe('within attribute', function() {
    describe('supports parent reference for string and conditional bindings', function() {
      // `parent` allows template code reference its component's logical parent component.
      // This should also work when using the `within` attribute to have "passed-in" content
      // use the model/attribute context internal to the component.

      var contentHtml =
        // Test parent reference in attribute string binding, attribute conditional binding...
        '<span class="{{parent.lighten(color)}} {{if parent.lighten(color)}}has-light-color{{/if}}">' +
          // ...and the same for text nodes.
          '{{parent.lighten(color)}}' +
          '{{if parent.lighten(color)}} (lightened){{/if}}' +
        '</span>';

      var swatchCases = {
        // First case
        'when using {{if content}} {{content}}':
          '{{if content}}' +
            '<div style="width: {{width}}px">' +
              '{{content}}' +
            '</div>' +
          '{{/if}}',
        // Second case
        'when using {{if content}} {{@content}}':
          '{{if content}}' +
            '<div style="width: {{width}}px">' +
              '{{@content}}' +
            '</div>' +
          '{{/if}}',
        // Third case
        'when using {{if @content}} {{content}}':
          '{{if @content}}' +
            '<div style="width: {{width}}px">' +
              '{{content}}' +
            '</div>' +
          '{{/if}}',
        // Fourth case
        'when using {{if @content}} {{@content}}':
          '{{if @content}}' +
            '<div style="width: {{width}}px">' +
              '{{@content}}' +
            '</div>' +
          '{{/if}}',
      };

      Object.keys(swatchCases).forEach(function(testLabel) {
        it(testLabel, function() {
          var app = runner.createHarness().app;
          var page = app.createPage();
    
          app.views.register('Body', '<view is="editor" width="{{_page.width}}"/>');
    
          function Editor() {}
          Editor.prototype.lighten = function(color) {
            return 'light' + color;
          };
          app.views.register('editor',
            '<view is="swatch" width="{{10}}" within>' + contentHtml + '</view>'
          );
          app.component('editor', Editor);
    
          function Swatch() {}
          Swatch.prototype.init = function() {
            this.model.set('color', 'blue');
          }
    
          app.views.register('swatch', swatchCases[testLabel]);
          app.component('swatch', Swatch);
    
          var fragment = page.getFragment('Body');
          expect(fragment).html(
            '<div style="width: 10px"><span class="lightblue has-light-color">lightblue (lightened)</span></div>'
          );
        });
      });
    });
  });
});
