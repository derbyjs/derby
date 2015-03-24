var expect = require('expect.js');
var DerbyStandalone = require('../../lib/DerbyStandalone');
var derby = new DerbyStandalone();
require('derby-parsing');

describe('bindings', function() {

  describe('bracket dependencies', function() {
    it('bracket inner dependency change', function() {
      var app = derby.createApp();
      app.views.register('Body', '{{_page.doc[_page.key]}}');
      var page = app.createPage();
      var doc = page.model.at('_page.doc');
      var key = page.model.at('_page.key');
      doc.set({
        one: 'hi',
        two: 'bye'
      });
      key.set('one');
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'hi');
      key.set('two');
      expectHtml(fragment, 'bye');
      key.del();
      expectHtml(fragment, '');
      key.set('one');
      expectHtml(fragment, 'hi');
    });

    it('bracket outer dependency change', function() {
      var app = derby.createApp();
      app.views.register('Body', '{{_page.doc[_page.key]}}');
      var page = app.createPage();
      var doc = page.model.at('_page.doc');
      var key = page.model.at('_page.key');
      doc.set({
        one: 'hi',
        two: 'bye'
      });
      key.set('one');
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'hi');
      doc.set('one', 'hello')
      expectHtml(fragment, 'hello');
      doc.set({
        one: 'heyo'
      });
      expectHtml(fragment, 'heyo');
      doc.del();
      expectHtml(fragment, '');
    });

    it('bracket inner then outer dependency change', function() {
      var app = derby.createApp();
      app.views.register('Body', '{{_page.doc[_page.key]}}');
      var page = app.createPage();
      var doc = page.model.at('_page.doc');
      var key = page.model.at('_page.key');
      doc.set({
        one: 'hi',
        two: 'bye'
      });
      key.set('one');
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'hi');
      key.set('two');
      expectHtml(fragment, 'bye');
      doc.set({
        one: 'heyo',
        two: 'later'
      });
      expectHtml(fragment, 'later');
      doc.set('two', 'adios');
      expectHtml(fragment, 'adios');
      key.set('one');
      expectHtml(fragment, 'heyo');
    });
  });

  describe('dynamic view instances', function() {
    it('simple dynamic view', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<view is="{{_page.view}}" optional></view>'
      );
      app.views.register('one', 'One');
      app.views.register('two', 'Two');
      var page = app.createPage();
      var view = page.model.at('_page.view');
      view.set('one');
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'One');
      view.set('two');
      expectHtml(fragment, 'Two');
      view.del();
      expectHtml(fragment, '');
      view.set('one');
      expectHtml(fragment, 'One');
    });
    it('bracketed dynamic view', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<view is="{{_page.names[_page.index]}}" optional></view>'
      );
      app.views.register('one', 'One');
      app.views.register('two', 'Two');
      app.views.register('three', 'Three');
      var page = app.createPage();
      page.model.set('_page.names', ['one', 'two']);
      var index = page.model.at('_page.index');
      index.set(0);
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'One');
      index.set(1);
      expectHtml(fragment, 'Two');
      index.del();
      expectHtml(fragment, '');
      index.set(0);
      expectHtml(fragment, 'One');
      page.model.set('_page.names', ['two', 'one']);
      expectHtml(fragment, 'Two');
      page.model.unshift('_page.names', 'three');
      expectHtml(fragment, 'Three');
    });
    it('only renders if the expression value changes', function() {
      var app = derby.createApp();
      var count = 0;
      app.proto.count = function() {
        return count++;
      };
      app.proto.lower = function(value) {
        return value.toLowerCase();
      };
      app.views.register('Body', '<view is="{{lower(_page.view)}}"></view>');
      app.views.register('one', 'One {{count()}}');
      app.views.register('two', 'Two {{count()}}');
      var page = app.createPage();
      var view = page.model.at('_page.view');
      view.set('one');
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'One 0');
      view.set('two');
      expectHtml(fragment, 'Two 1');
      view.set('TWO');
      expectHtml(fragment, 'Two 1');
      view.set('ONE');
      expectHtml(fragment, 'One 2');
      view.set('one');
      expectHtml(fragment, 'One 2');
    });
  });

  describe('basic blocks', function() {
    it('each else', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '{{each _page.items}}' +
          '{{this}}.' +
        '{{else}}' +
          'otherwise' +
        '{{/each}}'
      );
      var page = app.createPage();
      var fragment = page.getFragment('Body');
      expectHtml(fragment, 'otherwise');
      var items = page.model.at('_page.items');
      items.set(['one', 'two', 'three']);
      expectHtml(fragment, 'one.two.three.');
      items.set([]);
      expectHtml(fragment, 'otherwise');
      items.insert(0, ['one', 'two', 'three']);
      expectHtml(fragment, 'one.two.three.');
      items.remove(0, 2);
      expectHtml(fragment, 'three.');
      items.remove(0, 1);
      expectHtml(fragment, 'otherwise');
    });
  });

  describe('nested blocks', function() {
    it('each containing if', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '{{each _page.items as #item}}' +
          '{{if _page.toggle}}' +
            '{{#item}}.' +
          '{{/if}}' +
        '{{/each}}'
      );
      var page = app.createPage();
      var items = page.model.at('_page.items');
      var toggle = page.model.at('_page.toggle');
      var fragment = page.getFragment('Body');
      items.set(['one', 'two', 'three']);
      toggle.set(true);
      items.move(2, 1);
      expectHtml(fragment, 'one.three.two.');
    });
  });

  function testArray(itemTemplate, itemData) {
    it('each on path', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' + itemTemplate + '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    it('each on alias', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '{{with _page.items as #items}}' +
          '<ul>' +
            '{{each #items as #item, #i}}' + itemTemplate + '{{/each}}' +
          '</ul>' +
        '{{/with}}'
      );
      testEach(app);
    });
    it('each on relative path', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '{{with _page.items}}' +
          '<ul>' +
            '{{each this as #item, #i}}' + itemTemplate + '{{/each}}' +
          '</ul>' +
        '{{/with}}'
      );
      testEach(app);
    });
    it('each on relative subpath', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '{{with _page}}' +
          '<ul>' +
            '{{each this.items as #item, #i}}' + itemTemplate + '{{/each}}' +
          '</ul>' +
        '{{/with}}'
      );
      testEach(app);
    });
    it('each on attribute', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<view is="list" items="{{_page.items}}"></view>'
      );
      app.views.register('list',
        '<ul>' +
          '{{each @items as #item, #i}}' + itemTemplate + '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    it('each containing withs', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' +
            '{{with this}}' +
              '{{with this}}' +
                '{{with this}}' +
                  itemTemplate +
                '{{/with}}' +
              '{{/with}}' +
            '{{/with}}' +
          '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    it('each containing view instance', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' +
            '<view is="item"></view>' +
          '{{/each}}' +
        '</ul>'
      );
      app.views.register('item', itemTemplate);
      testEach(app);
    });
    it('each containing view instance containing with', function() {
      var app = derby.createApp();
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' +
            '<view is="item"></view>' +
          '{{/each}}' +
        '</ul>'
      );
      app.views.register('item', '{{with this}}' + itemTemplate + '{{/with}}');
      testEach(app);
    });
    function testEach(app) {
      var page = app.createPage();
      var items = page.model.at('_page.items');
      var fragment = page.getFragment('Body');
      expectHtml(fragment, '<ul></ul>');
      items.insert(0, itemData.slice(0, 2));
      expectHtml(fragment,
        '<ul><li>0. One One</li><li>1. Two Two</li></ul>'
      );
      items.push(itemData[2]);
      expectHtml(fragment,
        '<ul><li>0. One One</li><li>1. Two Two</li><li>2. Three Three</li></ul>'
      );
      items.unshift(itemData[3]);
      expectHtml(fragment,
        '<ul><li>0. Four Four</li><li>1. One One</li><li>2. Two Two</li><li>3. Three Three</li></ul>'
      );
      items.remove(1, 2);
      expectHtml(fragment,
        '<ul><li>0. Four Four</li><li>1. Three Three</li></ul>'
      );
      items.shift();
      expectHtml(fragment,
        '<ul><li>0. Three Three</li></ul>'
      );
      items.pop();
      expectHtml(fragment,
        '<ul></ul>'
      );
      items.pop();
      expectHtml(fragment,
        '<ul></ul>'
      );
      items.push(itemData[0]);
      expectHtml(fragment,
        '<ul><li>0. One One</li></ul>'
      );
    }
  }
  describe('array of objects', function() {
    testArray('<li>{{#i}}. {{#item.text}} {{this.text}}</li>', [
      {text: 'One'},
      {text: 'Two'},
      {text: 'Three'},
      {text: 'Four'}
    ]);
  });
  describe('array of strings', function() {
    testArray('<li>{{#i}}. {{#item}} {{this}}</li>', [
      'One',
      'Two',
      'Three',
      'Four'
    ]);
  });
});

function expectHtml(fragment, html) {
  expect(fragmentHtml(fragment)).equal(html);
}

function fragmentHtml(fragment) {
  var clone = document.importNode(fragment, true);
  // last two arguments for createTreeWalker are required in IE unfortunately
  var treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT, null, false);
  var toRemove = [];
  for (var node; node = treeWalker.nextNode();) {
    toRemove.push(node);
  }
  for (var i = toRemove.length; i--;) {
    toRemove[i].parentNode.removeChild(toRemove[i]);
  }
  var el = document.createElement('ins');
  el.appendChild(clone);
  return el.innerHTML;
}
