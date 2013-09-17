var testUtil = require('racer/test/util');
var expect = testUtil.expect;
var expressions = require('../lib/expressions');
var parsing = require('../lib/parsing');
var Views = require('../lib/Views');

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

  it('throws on a mismatched closing HTML tag', function() {
    expect(function() {
      parsing.createTemplate('<div><a></div>');
    }).to.throwException();
  });

});

describe('Parse and render dynamic text and blocks', function() {

  function test(source, expected) {
    var template = parsing.createTemplate(source);
    expect(template.get(context)).equal(expected);
  }

  it('value within text', function() {
    test('Say, "{{_page.greeting}}"', 'Say, "Howdy!"');
    test('{{_page.zero}}', '0');
    test('{{_page.nope}}', 'false');
    test('{{_page.yep}}', 'true');
    test('{{_page.nada}}', '');
    test('{{nothing}}', '');
  });

  it('with block', function() {
    test('{{with _page.yep}}yes{{/with}}', 'yes');
    test('{{with _page.nope}}yes{{/with}}', 'yes');
    test('{{with _page.yep}}{{this}}{{/with}}', 'true');
    test('{{with _page.nope}}{{this}}{{/with}}', 'false');
  });

  it('if block', function() {
    test('{{if _page.yep}}yes{{/if}}', 'yes');
    test('{{if _page.yep}}{{this}}{{/if}}', 'true');
    test('{{if _page.nope}}yes{{/if}}', '');
    test('{{if nothing}}yes{{/if}}', '');
  });

  it('unless block', function() {
    test('{{unless _page.yep}}yes{{/unless}}', '');
    test('{{unless _page.nope}}yes{{/unless}}', 'yes');
    test('{{unless _page.nope}}{{this}}{{/unless}}', 'false');
    test('{{unless nothing}}yes{{/unless}}', 'yes');
  });

  it('else block', function() {
    test('{{if _page.yep}}yes{{else}}no{{/if}}', 'yes');
    test('{{if _page.nope}}yes{{else}}no{{/if}}', 'no');
    test('{{if nothing}}yes{{else}}no{{/if}}', 'no');
  });

  it('else if block', function() {
    test('{{if _page.yep}}1{{else if _page.yep}}2{{else}}3{{/if}}', '1');
    test('{{if _page.nope}}1{{else if _page.yep}}2{{else}}3{{/if}}', '2');
    test('{{if _page.nope}}1{{else if _page.yep}}{{this}}{{else}}3{{/if}}', 'true');
    test('{{if _page.nope}}1{{else if _page.nope}}2{{else}}3{{/if}}', '3');
  });

  it('each block', function() {
    test('{{each _page.letters}}{{this}}:{{/each}}', 'A:B:C:');
    test('{{each [1, 2, 3]}}{{this * 2}}{{/each}}', '246');
    test('{{each [1, _page.zero, 3]}}{{this * 2}}{{/each}}', '206');
    test('{{each [2, 1, 0]}}{{_page.letters[this]}}{{/each}}', 'CBA');
    test('{{each _page.matrix[1]}}{{this}}:{{/each}}', '1:0:');
  });

  it('each else block', function() {
    test('{{each _page.letters}}{{this}}:{{else}}Nada{{/each}}', 'A:B:C:');
    test('{{each _page.emptyList}}{{this}}:{{else}}Nada{{/each}}', 'Nada');
    test('{{each nothing}}{{this}}:{{else}}Nada{{/each}}', 'Nada');
  });

  it('nested each blocks', function() {
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

describe('View insertion', function() {

  it('can register and find a view', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '<div></div>');
    var view = views.find('body');
    expect(view.get(context)).equal('<div></div>');
  });

  describe('inserts a literal view', function() {
    function test(source) {
      it(source, function() {
        var views = new Views();
        context.meta.views = views;
        views.register('app:body', source);
        views.register('app:section', '<div></div>');
        var view = views.find('body');
        expect(view.get(context)).equal('<div></div>');
      });
    }
    test('{{view "section"}}');
    test('<view name="section"></view>');
  });

  describe('inserts a dynamic view', function() {
    function test(source) {
      it(source, function() {
        var views = new Views();
        context.meta.views = views;
        views.register('app:body', source);
        views.register('app:section', '<div></div>');
        var view = views.find('body');
        expect(view.get(context)).equal('<div></div>');
      });
    }
    test('{{view _page.view}}');
    test('<view name="{{_page.view}}"></view>');
  });

  describe('inserts a view with literal arguments', function() {
    function test(source) {
      it(source, function() {
        var views = new Views();
        context.meta.views = views;
        views.register('app:body', source);
        views.register('app:section', '<div>{{@text}}</div>');
        var view = views.find('body');
        expect(view.get(context)).equal('<div>Hi</div>');
      });
    }
    test('{{view "section", {text: "Hi"}}}');
    test('<view name="section" text="Hi"></view>');
  });

  describe('inserts a view with dynamic arguments', function() {
    function test(source) {
      it(source, function() {
        var views = new Views();
        context.meta.views = views;
        views.register('app:body', source);
        views.register('app:section', '<div>{{@text}}</div>');
        var view = views.find('body');
        expect(view.get(context)).equal('<div>Howdy!</div>');
      });
    }
    test('{{view "section", {text: _page.greeting}}}');
    test('<view name="section" text="{{_page.greeting}}"></view>');
  });

  it('passes HTML inside <view> as {{@content}}', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '<view name="section"><b>Hi</b></view>');
    views.register('app:section', '<div>{{@content}}</div>');
    var view = views.find('body');
    expect(view.get(context)).equal('<div><b>Hi</b></div>');
  });

  it('content can be overridden', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '<view name="section" content="Stuff"><b>Hi</b></view>');
    views.register('app:section', '<div>{{@content}}</div>');
    var view = views.find('body');
    expect(view.get(context)).equal('<div>Stuff</div>');
  });

  it('parent content can be passed through', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '<view name="section"><b>Hi</b></view>');
    views.register('app:section', '<div><view name="paragraph" content="{{@content}}"></view></div>');
    views.register('app:paragraph', '<p>{{@content}}</p>');
    var view = views.find('body');
    expect(view.get(context)).equal('<div><p><b>Hi</b></p></div>');
  });

  it('views can define custom child attribute tags', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body', '<view name="section"><title><b>Hi</b></title>More text</view>');
    views.register('app:section', '<h3>{{@title}}</h3><div>{{@content}}</div>', {attributes: 'title'});
    var view = views.find('body');
    expect(view.get(context)).equal('<h3><b>Hi</b></h3><div>More text</div>');
  });

  it('views can define custom child attribute tags', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body'
    , '<view name="section">' +
        '<title><b>Hi</b></title>' +
        'More text' +
      '</view>'
    );
    views.register('app:section'
    , '<h3>{{@title}}</h3>' +
      '<div>{{@content}}</div>'
    , {attributes: 'title'}
    );
    var view = views.find('body');
    expect(view.get(context)).equal('<h3><b>Hi</b></h3><div>More text</div>');
  });

  it('views support generic attribute tags', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body'
    , '<view name="section">' +
        '<attribute name="title"><b>Hi</b></attribute>' +
        'More text' +
      '</view>'
    );
    views.register('app:section'
    , '<h3>{{@title}}</h3>' +
      '<div>{{@content}}</div>'
    );
    var view = views.find('body');
    expect(view.get(context)).equal('<h3><b>Hi</b></h3><div>More text</div>');
  });

  it('views can define custom child array tags', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body'
    , '<view name="tabs">' +
        '<pane title="One"><b>Hi</b></pane>' +
        '<pane title="Two">Ho</pane>' +
      '</view>'
    );
    views.register('app:tabs'
    , '<ul>' +
        '{{each @pane}}' +
          '<li>{{this.title}}</li>' +
        '{{/each}}' +
      '</ul>' +
      '{{each @pane}}' +
        '<div>{{this.content}}</div>' +
      '{{/each}}'
    , {arrays: 'pane'}
    );
    var view = views.find('body');
    expect(view.get(context)).equal(
      '<ul>' +
        '<li>One</li>' +
        '<li>Two</li>' +
      '</ul>' +
      '<div><b>Hi</b></div>' +
      '<div>Ho</div>'
    );
  });

  it('views support generic array tags', function() {
    var views = new Views();
    context.meta.views = views;
    views.register('app:body'
    , '<view name="tabs">' +
        '<array name="pane" title="One"><b>Hi</b></array>' +
        '<array name="pane" title="Two">Ho</array>' +
      '</view>'
    );
    views.register('app:tabs'
    , '<ul>' +
        '{{each @pane}}' +
          '<li>{{this.title}}</li>' +
        '{{/each}}' +
      '</ul>' +
      '{{each @pane}}' +
        '<div>{{this.content}}</div>' +
      '{{/each}}'
    );
    var view = views.find('body');
    expect(view.get(context)).equal(
      '<ul>' +
        '<li>One</li>' +
        '<li>Two</li>' +
      '</ul>' +
      '<div><b>Hi</b></div>' +
      '<div>Ho</div>'
    );
  });

});
