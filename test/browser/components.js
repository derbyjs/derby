var templates = require('derby-templates').templates;
var util = require('./util');
var derby = util.derby;
var expectHtml = util.expectHtml;

describe('components', function() {

  describe('dependencies', function() {
    it('gets dependencies rendered inside of components', function() {
      var app = derby.createApp();
      var page = app.createPage();
      app.views.register('Body',
        '<view is="box" title="{{_page.title}}, friend">' +
          '{{_page.message}}!' +
        '</view>'
      );
      app.views.register('box',
        '<div class="box">' +
          '<view is="box-title">{{@title}}</view>' +
          '{{@content}}' +
        '</div>'
      );
      app.views.register('box-title',
        '<b>{{@content}}</b>'
      );
      app.component('box', function Box() {});
      app.component('box-title', function BoxTitle() {});
      var view = app.views.find('Body');
      expect(view.dependencies(page.context)).eql([
        ['_page', 'title'],
        ['_page', 'message']
      ]);
    });

    it('does not return dependencies for local paths within components', function() {
      var app = derby.createApp();
      var page = app.createPage();
      app.views.register('Body',
        '<view is="box" title="{{_page.title}}"></view>'
      );
      app.views.register('box',
        '<div class="box">' +
          '<view is="box-title">{{@title}}</view>' +
          '{{messages[currentMessage]}}' +
          '<small>{{#root._page.disclaimer}}</small>' +
        '</div>'
      );
      app.views.register('box-title',
        '<b class="{{if show}}visible{{/if}}">' +
          '{{if happy}}' +
            '{{emphasize(@content)}}' +
          '{{else}}' +
            '{{@content}}' +
          '{{/if}}' +
        '</b>'
      );
      app.component('box', function Box() {});
      app.component('box-title', function BoxTitle() {});
      var view = app.views.find('Body');
      expect(view.dependencies(page.context)).eql([
        ['_page', 'title'],
        ['_page', 'disclaimer']
      ]);
    });
  });

  describe('attribute to model binding', function() {
    it('updates model when path attribute changes', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.color', 'blue');
      this.app.views.register('Body',
        '<view is="swatch" value="{{_page.color}}"></view>'
      );
      this.app.views.register('swatch',
        '<div style="background-color: {{value}}"></div>'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      expectHtml(fragment, '<div style="background-color: blue"></div>');
      this.page.model.set('_page.color', 'gray');
      expectHtml(fragment, '<div style="background-color: gray"></div>');
    });

    it('updates model when expression attribute changes', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.color', 'blue');
      this.app.proto.concat = function() {
        return Array.prototype.join.call(arguments, '');
      };
      this.app.views.register('Body',
        '<view is="swatch" value="{{concat(\'light\', _page.color)}}"></view>'
      );
      this.app.views.register('swatch',
        '{{@value}}<view is="color" value="{{value}}"></view>'
      );
      this.app.views.register('color',
        '<div style="background-color: {{value}}"></div>'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      expectHtml(fragment, 'lightblue<div style="background-color: lightblue"></div>');
      this.page.model.set('_page.color', 'gray');
      expectHtml(fragment, 'lightgray<div style="background-color: lightgray"></div>');
    });

    it('updates model when template attribute changes', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.color', 'blue');
      this.app.proto.concat = function() {
        return Array.prototype.join.call(arguments, '');
      };
      this.app.views.register('Body',
        '<view is="swatch" value="light{{_page.color}}"></view>'
      );
      this.app.views.register('swatch',
        '<view is="color"></view>'
      );
      this.app.views.register('color',
        '{{value}}<div style="background-color: {{value}}"></div>'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      expectHtml(fragment, 'lightblue<div style="background-color: lightblue"></div>');
      this.page.model.set('_page.color', 'gray');
      expectHtml(fragment, 'lightgray<div style="background-color: lightgray"></div>');
    });

    it('updates view expression', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.color', 'blue');
      this.page.model.set('_page.view', 'back');
      this.app.proto.concat = function() {
        return Array.prototype.join.call(arguments, '');
      };
      this.app.views.register('Body',
        '<view is="swatch" value="{{view _page.view, {value: _page.color}}}"></view>'
      );
      this.app.views.register('swatch',
        '<div style="{{value}}">{{value}}</div>'
      );
      this.app.views.register('back',
        'background-color: light{{@value}}'
      );
      this.app.views.register('fore',
        'color: light{{@value}}'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      expectHtml(fragment, '<div style="background-color: lightblue">background-color: lightblue</div>');
      this.page.model.set('_page.color', 'gray');
      expectHtml(fragment, '<div style="background-color: lightgray">background-color: lightgray</div>');
      this.page.model.set('_page.view', 'fore');
      expectHtml(fragment, '<div style="color: lightgray">color: lightgray</div>');
    });

    it('updates when template attribute is updated to new value inside component model', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.color', 'blue');
      this.app.proto.concat = function() {
        return Array.prototype.join.call(arguments, '');
      };
      this.app.views.register('Body',
        '<view is="swatch" value="light{{_page.color}}"></view>'
      );
      this.app.views.register('swatch',
        '<div style="background-color: {{value}}">{{value}}</div>'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, '<div style="background-color: lightblue">lightblue</div>');
      var previous = swatch.model.set('value', 'gray');
      expectHtml(fragment, '<div style="background-color: gray">gray</div>');
      expect(this.page.model.get('_page.color')).equal('blue');
      swatch.model.set('value', previous);
      expectHtml(fragment, '<div style="background-color: lightblue">lightblue</div>');
    });

    it('updates within template content', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.width', 10);
      this.page.model.set('_page.color', 'blue');
      this.app.views.register('Body',
        '<view is="swatch" width="{{_page.width}}" within>' +
          'light{{#color}}' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with #root._page.color as #color}}' +
          '<div style="width: {{width}}px; background-color: {{content}}">' +
            '{{content}}' +
          '</div>' +
        '{{/with}}'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      expectHtml(fragment, '<div style="width: 10px; background-color: lightblue">lightblue</div>');
      this.page.model.set('_page.color', 'green');
      expectHtml(fragment, '<div style="width: 10px; background-color: lightgreen">lightgreen</div>');
    });

    it('updates within template attribute', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<attribute is="message" within>{{if #show}}Show me!{{else}}Hide me.{{/if}}</attribute>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with show as #show}}' +
          '<div>{{@message}}</div>' +
        '{{/with}}'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, '<div>Hide me.</div>');
      expect(swatch.model.get('message')).a(templates.Template);
      swatch.model.set('show', true);
      expectHtml(fragment, '<div>Show me!</div>');
      expect(swatch.model.get('message')).a(templates.Template);
    });

    it('updates within template attribute in model', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<attribute is="message" within>{{if #show}}Show me!{{else}}Hide me.{{/if}}</attribute>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with show as #show}}' +
          '<div>{{message}}</div>' +
        '{{/with}}'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, '<div>Hide me.</div>');
      expect(swatch.model.get('message')).a(templates.Template);
      swatch.model.set('show', true);
      expectHtml(fragment, '<div>Show me!</div>');
      expect(swatch.model.get('message')).a(templates.Template);
    });

    it('updates within expression attribute by making it a template', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<attribute is="message" within>{{#show ? "Show me!" : "Hide me."}}</attribute>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with show as #show}}' +
          '<div>{{message}}</div>' +
        '{{/with}}'
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, '<div>Hide me.</div>');
      expect(swatch.model.get('message')).a(templates.Template);
      expect(swatch.getAttribute('message')).equal('Hide me.');
      swatch.model.set('show', true);
      expectHtml(fragment, '<div>Show me!</div>');
      // getAttribute works, but the rendering context is just inside the
      // component, so the alias is not defined
      expect(swatch.getAttribute('message')).equal('Hide me.');
    });

    it('updates within attribute bound to component model path', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<attribute is="message" within>{{if show}}Show me!{{else}}Hide me.{{/if}}</attribute>' +
        '</view>'
      );
      this.app.views.register('swatch', '<div>{{message}}</div>');
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, '<div>Hide me.</div>');
      expect(swatch.model.get('message')).a(templates.Template);
      expect(swatch.getAttribute('message')).equal('Hide me.');
      swatch.model.set('show', true);
      expectHtml(fragment, '<div>Show me!</div>');
      expect(swatch.getAttribute('message')).equal('Show me!');
    });

    it('updates array within template attribute', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<item within>{{if #show}}Show me!{{else}}Hide me.{{/if}}</item>' +
          '<item>{{if #show}}Show me!{{else}}Hide me.{{/if}}</item>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with show as #show}}' +
          '{{each @items as #item}}' +
            '{{#item.content}}' +
          '{{/each}}' +
        '{{/with}}',
        {arrays: 'item/items'}
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, 'Hide me.Hide me.');
      expect(swatch.getAttribute('items')).eql([
        {content: 'Hide me.'},
        {content: 'Hide me.'},
      ]);
      swatch.model.set('show', true);
      expectHtml(fragment, 'Show me!Hide me.');
      expect(swatch.getAttribute('items')).eql([
        {content: 'Hide me.'},
        {content: 'Hide me.'},
      ]);
    });

    it('updates array within template attribute in model', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<item within>{{if #show}}Show me!{{else}}Hide me.{{/if}}</item>' +
          '<item>{{if #show}}Show me!{{else}}Hide me.{{/if}}</item>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with show as #show}}' +
          '{{each items as #item}}' +
            '{{#item.content}}' +
          '{{/each}}' +
        '{{/with}}',
        {arrays: 'item/items'}
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, 'Hide me.Hide me.');
      expect(swatch.model.get('items').length).equal(2);
      expect(swatch.model.get('items')[0].content).a(templates.Template);
      expect(swatch.model.get('items')[1].content).a(templates.Template);
      swatch.model.set('show', true);
      expectHtml(fragment, 'Show me!Hide me.');
    });

    it('updates array within attribute bound to component model path', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<item within>{{if show}}Show me!{{else}}Hide me.{{/if}}</item>' +
          '<item>{{if show}}Show me!{{else}}Hide me.{{/if}}</item>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{each @items as #item}}' +
          '{{#item.content}}' +
        '{{/each}}',
        {arrays: 'item/items'}
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, 'Hide me.Hide me.');
      expect(swatch.getAttribute('items')).eql([
        {content: 'Hide me.'},
        {content: 'Hide me.'},
      ]);
      swatch.model.set('show', true);
      expectHtml(fragment, 'Show me!Hide me.');
      expect(swatch.getAttribute('items')).eql([
        {content: 'Show me!'},
        {content: 'Hide me.'},
      ]);
    });

    it('updates array within expression attribute by making it a template', function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.app.views.register('Body',
        '<view is="swatch">' +
          '<item within>{{#show ? "Show me!" : "Hide me."}}</item>' +
          '<item>{{#show ? "Show me!" : "Hide me."}}</item>' +
        '</view>'
      );
      this.app.views.register('swatch',
        '{{with show as #show}}' +
          '{{each items as #item}}' +
            '{{#item.content}}' +
          '{{/each}}' +
        '{{/with}}',
        {arrays: 'item/items'}
      );
      function Swatch() {}
      this.Swatch = Swatch;
      this.app.component('swatch', Swatch);
      var fragment = this.page.getFragment('Body');
      var swatch = this.page._components._1;
      expectHtml(fragment, 'Hide me.Hide me.');
      expect(swatch.model.get('items').length).equal(2);
      expect(swatch.model.get('items')[0].content).a(templates.Template);
      expect(swatch.model.get('items')[1].content).equal('Hide me.')
      swatch.model.set('show', true);
      expectHtml(fragment, 'Show me!Hide me.');
    });

  });

  describe('rendering', function() {
    beforeEach(function() {
      this.app = derby.createApp();
      this.page = this.app.createPage();
      this.page.model.set('_page.title', 'Good day');
      this.app.views.register('Body',
        '<view is="box" role="container" title="{{_page.title}}">' +
          '<view is="box" role="inner1" title="Greeting">Hello.</view>' +
          '<view is="box" role="inner2"></view>' +
        '</view>'
      );
      this.app.views.register('box',
        '<div class="box">' +
          '<view is="box-title" tip="{{@title}}">{{@title}}</view>' +
          '{{@content}}' +
        '</div>'
      );
      this.app.views.register('box-title',
        '<b title="{{@tip}}">{{@content}}</b>'
      );
      function Box() {}
      this.Box = Box;
      this.app.component('box', this.Box);
      function BoxTitle() {}
      this.BoxTitle = BoxTitle;
      this.app.component('box-title', this.BoxTitle);
    });

    it('renders a component', function() {
      var html = this.page.get('Body');
      expect(html).equal(
        '<div class="box">' +
          '<b title="Good day">Good day</b>' +
          '<div class="box"><b title="Greeting">Greeting</b>Hello.</div>' +
          '<div class="box"><b></b></div>' +
        '</div>'
      );
    });

    it('sets attributes as values on component model', function() {
      var tests = {
        container: function(box, boxTitle) {
          expect(box.model.get('title')).equal('Good day');
          expect(boxTitle.model.get('tip')).equal('Good day');
          expect(boxTitle.model.get('content')).equal('Good day');
        },
        inner1: function(box, boxTitle) {
          expect(box.model.get('title')).equal('Greeting');
          expect(box.model.get('content')).equal('Hello.');
          expect(boxTitle.model.get('tip')).equal('Greeting');
          expect(boxTitle.model.get('content')).equal('Greeting');
        },
        inner2: function(box, boxTitle) {
          expect(box.model.get('title')).equal(undefined);
          expect(box.model.get('content')).equal(undefined);
          expect(boxTitle.model.get('tip')).equal(undefined);
          expect(boxTitle.model.get('content')).equal(undefined);
        }
      };
      testInit.call(this, tests);
    });

    it('Component::getAttribute returns passed in values', function() {
      var tests = {
        container: function(box, boxTitle) {
          expect(box.getAttribute('title')).equal('Good day');
          expect(boxTitle.getAttribute('tip')).equal('Good day');
          expect(boxTitle.getAttribute('content')).equal('Good day');
        },
        inner1: function(box, boxTitle) {
          expect(box.getAttribute('title')).equal('Greeting');
          expect(box.getAttribute('content')).equal('Hello.');
          expect(boxTitle.getAttribute('tip')).equal('Greeting');
          expect(boxTitle.getAttribute('content')).equal('Greeting');
        },
        inner2: function(box, boxTitle) {
          expect(box.getAttribute('title')).equal(undefined);
          expect(box.getAttribute('content')).equal(undefined);
          expect(boxTitle.getAttribute('tip')).equal(undefined);
          expect(boxTitle.getAttribute('content')).equal(undefined);
        }
      };
      testInit.call(this, tests);
    });

    function testInit(tests) {
      this.BoxTitle.prototype.init = function() {
        var box = this.parent;
        var boxTitle = this;
        var role = box.model.get('role');
        tests[role](box, boxTitle);
        delete tests[role];
      }
      this.page.getFragment('Body');
      expect(Object.keys(tests).length).equal(0);
    }
  });

});
