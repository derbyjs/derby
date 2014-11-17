var expect = require('expect.js');
var DerbyStandalone = require('../../lib/DerbyStandalone');
var derby = new DerbyStandalone();
require('derby-parsing');

describe('bindings', function() {
  it('each on path', function() {
    var app = derby.createApp();
    app.views.register('Body',
      '<ul>' +
        '{{each _page.items as #item, #i}}' +
          '<li>{{#i}}. {{#item.text}}</li>' +
        '{{/each}}' +
      '</ul>'
    );
    testEach(app);
  });
  it('each on alias', function() {
    var app = derby.createApp();
    app.views.register('Body',
      '{{with _page.items as #items}}' +
        '<ul>' +
          '{{each #items as #item, #i}}' +
            '<li>{{#i}}. {{#item.text}}</li>' +
          '{{/each}}' +
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
        '{{each @items as #item, #i}}' +
          '<li>{{#i}}. {{#item.text}}</li>' +
        '{{/each}}' +
      '</ul>'
    );
    testEach(app);
  });
  function testEach(app) {
    var page = app.createPage();
    var items = page.model.at('_page.items');
    items.set([
      {text: 'One'},
      {text: 'Two'}
    ]);
    var fragment = page.getFragment('Body');
    expectHtml(fragment,
      '<ul><li>0. One</li><li>1. Two</li></ul>'
    );
    items.push({text: 'Three'});
    expectHtml(fragment,
      '<ul><li>0. One</li><li>1. Two</li><li>2. Three</li></ul>'
    );
    items.unshift({text: 'Four'});
    expectHtml(fragment,
      '<ul><li>0. Four</li><li>1. One</li><li>2. Two</li><li>3. Three</li></ul>'
    );
  }
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
