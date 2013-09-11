var testUtil = require('racer/test/util');
var expect = testUtil.expect;
var expressions = require('../lib/expressions');
var parsing = require('../lib/parsing');
var Views = require('../lib/views').Views;

var data = {
  _page: {
    greeting: 'Howdy!'
  , zero: 0
  , yep: true
  , nope: false
  , nada: null
  , letters: ['A', 'B', 'C']
  , emptyList: []
  , matrix: [[0, 1], [1, 0]]
  , view: 'section'
  }
};
var objectModel = new expressions.ObjectModel(data);
var contextMeta = new expressions.ContextMeta({});
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
      var template = parsing.createTemplate(source);
      expect(template.get()).equal(source);
    });
  }
});

describe('Parse and render dynamic text and blocks', function() {

  function test(source, expected) {
    var template = parsing.createTemplate(source);
    expect(template.get(context)).equal(expected);
  }

  it('Value within text', function() {
    test('Say, "{{_page.greeting}}"', 'Say, "Howdy!"');
    test('{{_page.zero}}', '0');
    test('{{_page.nope}}', 'false');
    test('{{_page.yep}}', 'true');
    test('{{_page.nada}}', '');
    test('{{nothing}}', '');
  });

  it('With block', function() {
    test('{{with _page.yep}}yes{{/with}}', 'yes');
    test('{{with _page.nope}}yes{{/with}}', 'yes');
    test('{{with _page.yep}}{{this}}{{/with}}', 'true');
    test('{{with _page.nope}}{{this}}{{/with}}', 'false');
  });

  it('If block', function() {
    test('{{if _page.yep}}yes{{/if}}', 'yes');
    test('{{if _page.yep}}{{this}}{{/if}}', 'true');
    test('{{if _page.nope}}yes{{/if}}', '');
    test('{{if nothing}}yes{{/if}}', '');
  });

  it('Unless block', function() {
    test('{{unless _page.yep}}yes{{/unless}}', '');
    test('{{unless _page.nope}}yes{{/unless}}', 'yes');
    test('{{unless _page.nope}}{{this}}{{/unless}}', 'false');
    test('{{unless nothing}}yes{{/unless}}', 'yes');
  });

  it('Else block', function() {
    test('{{if _page.yep}}yes{{else}}no{{/if}}', 'yes');
    test('{{if _page.nope}}yes{{else}}no{{/if}}', 'no');
    test('{{if nothing}}yes{{else}}no{{/if}}', 'no');
  });

  it('Else if block', function() {
    test('{{if _page.yep}}1{{else if _page.yep}}2{{else}}3{{/if}}', '1');
    test('{{if _page.nope}}1{{else if _page.yep}}2{{else}}3{{/if}}', '2');
    test('{{if _page.nope}}1{{else if _page.yep}}{{this}}{{else}}3{{/if}}', 'true');
    test('{{if _page.nope}}1{{else if _page.nope}}2{{else}}3{{/if}}', '3');
  });

  it('Each block', function() {
    test('{{each _page.letters}}{{this}}:{{/each}}', 'A:B:C:');
    test('{{each [1, 2, 3]}}{{this * 2}}{{/each}}', '246');
    test('{{each [1, _page.zero, 3]}}{{this * 2}}{{/each}}', '206');
    test('{{each [2, 1, 0]}}{{_page.letters[this]}}{{/each}}', 'CBA');
    test('{{each _page.matrix[1]}}{{this}}:{{/each}}', '1:0:');
  });

  it('Each else block', function() {
    test('{{each _page.letters}}{{this}}:{{else}}Nada{{/each}}', 'A:B:C:');
    test('{{each _page.emptyList}}{{this}}:{{else}}Nada{{/each}}', 'Nada');
    test('{{each nothing}}{{this}}:{{else}}Nada{{/each}}', 'Nada');
  });

  it('Nested each blocks', function() {
    test(
      '{{each _page.matrix}}' +
        '{{each this}}' +
          '{{this}}.' +
        '{{/each}};' +
      '{{/each}}'
    , '0.1.;1.0.;'
    );
    test(
      '{{each _page.matrix}}' +
        '{{each this}}' +
          '{{each _page.matrix}}' +
            '{{each this}}' +
              '{{this}}!' +
            '{{/each}}|' +
          '{{/each}}' +
          '{{this}}.' +
        '{{/each}};' +
      '{{/each}}'
    , '0!1!|1!0!|0.' +
      '0!1!|1!0!|1.;' +
      '0!1!|1!0!|1.' +
      '0!1!|1!0!|0.;'
    );
  });

});

describe('Views', function() {

  it('Can register and find a view', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '<div></div>');
    var view = views.find('body');
    expect(view.getTemplate().get(context)).equal('<div></div>');
  });

  it('Includes a literal view via {{view}}', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '{{view "section"}}');
    views.register('app:section', '<div></div>')
    var view = views.find('body');
    expect(view.getTemplate().get(context)).equal('<div></div>');
  });

  it('Includes a dynamic view via {{view}}', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '{{view _page.view}}');
    views.register('app:section', '<div></div>')
    var view = views.find('body');
    expect(view.getTemplate().get(context)).equal('<div></div>');
  });

  it.skip('Includes a literal view with arguments via {{view}}', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '{{view "section", {text: "Hi"}}}');
    views.register('app:section', '<div>{{@text}}</div>')
    var view = views.find('body');
    expect(view.getTemplate().get(context)).equal('<div>Hi</div>');
  });

});
