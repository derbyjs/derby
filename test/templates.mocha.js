var testUtil = require('racer/test/util');
var expect = testUtil.expect;
var defaultFns = require('../lib/defaultFns');
var expressions = require('../lib/expressions');
var templates = require('../lib/templates');

var data = {
  _page: {
    greeting: 'Howdy!'
  , zero: 0
  , yep: true
  , nope: false
  }
};
var objectModel = new expressions.ObjectModel(data);
var contextMeta = new expressions.ContextMeta({fns: defaultFns});
var context = new expressions.Context(contextMeta, objectModel);

describe('Parse and render literal HTML', function() {

  var literalTests = {
    'empty string': ''
  , 'empty div': '<div></div>'
  , 'div with attributes': '<div class="page home" title="Home"></div>'
  , 'text': 'Hi.'
  , 'conditional comment': '<!--[if IE 6]>Yikes!<![endif]-->'
  , 'div containing text': '<div> </div>'
  , 'nested divs': '<div><div></div></div>'
  , 'sibling divs': '<div></div><div></div>'
  , 'input': '<input type="text">'
  , 'void and nonvoid elements': '<div><img><br><b>Hi</b></div><br><div></div>'
  }

  for (var name in literalTests) {
    test(name, literalTests[name]);
  }
  function test(name, source) {
    it(name, function() {
      var template = templates.createTemplate(source);
      expect(template.get()).equal(source);
    });
  }
});

describe('Parse and render dynamic text and blocks', function() {

  function test(source, expected) {
    var template = templates.createTemplate(source);
    expect(template.get(context)).equal(expected);
  }

  it('Value within text', function() {
    test('Say, "{{_page.greeting}}"', 'Say, "Howdy!"');
  });

  it('If block', function() {
    test('{{if _page.yep}}yes{{/if}}', 'yes');
    test('{{if _page.nope}}yes{{/if}}', '');
    test('{{if nothing}}yes{{/if}}', '');
  });

  it('Unless block', function() {
    test('{{unless _page.yep}}yes{{/unless}}', '');
    test('{{unless _page.nope}}yes{{/unless}}', 'yes');
    test('{{unless nothing}}yes{{/unless}}', 'yes');
  });

  it('If else block', function() {
    test('{{if _page.yep}}yes{{else}}no{{/if}}', 'yes');
    test('{{if _page.nope}}yes{{else}}no{{/if}}', 'no');
    test('{{if nothing}}yes{{else}}no{{/if}}', 'no');
  });

});
