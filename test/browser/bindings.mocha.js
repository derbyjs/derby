var expect = require('expect.js');
var DerbyStandalone = require('../../lib/DerbyStandalone');
var derby = new DerbyStandalone();
require('derby-parsing');

describe('bindings', function() {
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
        '<view is="list" items="{{_page.items}}" />'
      );
      app.views.register('list',
        '<ul>' +
          '{{each @items as #item, #i}}' + itemTemplate + '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    function testEach(app) {
      var page = app.createPage();
      var items = page.model.at('_page.items');
      items.set(itemData.slice(0,2));
      var fragment = page.getFragment('Body');
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
  var treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
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
