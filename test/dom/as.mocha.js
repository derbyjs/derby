var expect = require('chai').expect;
var derby = require('./util').derby;

describe('as', function() {
  it('HTML element `as` property', function() {
    var app = derby.createApp();
    app.views.register('Body', '<div as="nested[0]"></div>');
    var page = app.createPage();
    var fragment = page.getFragment('Body');
    expect(page.nested[0]).html('<div></div>');
    expect(fragment).html('<div></div>');
  });

  it('Component `as` property', function() {
    var app = derby.createApp();
    app.views.register('Body', '<view is="item" as="nested[0]"></view>');
    app.views.register('item', '<div></div>')
    function Item() {};
    app.component('item', Item);
    var page = app.createPage();
    var fragment = page.getFragment('Body');
    expect(page.nested[0]).instanceof(Item);
    expect(page.nested[0].markerNode.nextSibling).html('<div></div>');
    expect(fragment).html('<div></div>');
  });

  it('HTML element `as-object` property', function() {
    var app = derby.createApp();
    app.views.register('Body',
      '<ul>' +
        '{{each _page.items}}' +
          '<li as-object="nested.map, this.id">{{this.text}}</li>' +
        '{{/each}}' +
      '</ul>'
    );
    var page = app.createPage();
    page.model.set('_page.items', [
      {id: 'a', text: 'A'},
      {id: 'b', text: 'B'},
      {id: 'c', text: 'C'}
    ]);
    var fragment = page.getFragment('Body');

    expect(page.nested.map).all.keys('a', 'b', 'c');
    expect(page.nested.map.a).html('<li>A</li>');
    expect(page.nested.map.b).html('<li>B</li>');
    expect(page.nested.map.c).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.map).all.keys('a', 'c');
    expect(page.nested.map.a).html('<li>A</li>');
    expect(page.nested.map.c).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.map).all.keys('a', 'c', 'd');
    expect(page.nested.map.a).html('<li>A</li>');
    expect(page.nested.map.c).html('<li>C</li>');
    expect(page.nested.map.d).html('<li>D</li>');
    expect(fragment).html('<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.map).eql({});
    expect(fragment).html('<ul></ul>');
  });

  it('Component `as-object` property', function() {
    var app = derby.createApp();
    app.views.register('Body',
      '<ul>' +
        '{{each _page.items}}' +
          '<view is="item" as-object="nested.map, this.id">' +
            '{{this.text}}' +
          '</view>' +
        '{{/each}}' +
      '</ul>'
    );
    app.views.register('item', '<li>{{@content}}</li>');
    function Item() {};
    app.component('item', Item);
    var page = app.createPage();
    page.model.set('_page.items', [
      {id: 'a', text: 'A'},
      {id: 'b', text: 'B'},
      {id: 'c', text: 'C'}
    ]);
    var fragment = page.getFragment('Body');

    expect(page.nested.map).all.keys('a', 'b', 'c');
    expect(page.nested.map.a).instanceof(Item);
    expect(page.nested.map.b).instanceof(Item);
    expect(page.nested.map.c).instanceof(Item);
    expect(page.nested.map.a.markerNode.nextSibling).html('<li>A</li>');
    expect(page.nested.map.b.markerNode.nextSibling).html('<li>B</li>');
    expect(page.nested.map.c.markerNode.nextSibling).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.map).all.keys('a', 'c');
    expect(page.nested.map.a).instanceof(Item);
    expect(page.nested.map.c).instanceof(Item);
    expect(page.nested.map.a.markerNode.nextSibling).html('<li>A</li>');
    expect(page.nested.map.c.markerNode.nextSibling).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.map).all.keys('a', 'c', 'd');
    expect(page.nested.map.a).instanceof(Item);
    expect(page.nested.map.c).instanceof(Item);
    expect(page.nested.map.d).instanceof(Item);
    expect(page.nested.map.a.markerNode.nextSibling).html('<li>A</li>');
    expect(page.nested.map.c.markerNode.nextSibling).html('<li>C</li>');
    expect(page.nested.map.d.markerNode.nextSibling).html('<li>D</li>');
    expect(fragment).html('<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.map).eql({});
    expect(fragment).html('<ul></ul>');
  });

  it('HTML element `as-array` property', function() {
    var app = derby.createApp();
    app.views.register('Body',
      '<ul>' +
        '{{each _page.items}}' +
          '<li as-array="nested.list">{{this.text}}</li>' +
        '{{/each}}' +
      '</ul>'
    );
    var page = app.createPage();
    page.model.set('_page.items', [
      {id: 'a', text: 'A'},
      {id: 'b', text: 'B'},
      {id: 'c', text: 'C'}
    ]);
    var fragment = page.getFragment('Body');

    expect(page.nested.list).an('array');
    expect(page.nested.list).length(3);
    expect(page.nested.list[0]).html('<li>A</li>');
    expect(page.nested.list[1]).html('<li>B</li>');
    expect(page.nested.list[2]).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.list).length(2);
    expect(page.nested.list[0]).html('<li>A</li>');
    expect(page.nested.list[1]).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.list).length(3);
    expect(page.nested.list[0]).html('<li>D</li>');
    expect(page.nested.list[1]).html('<li>A</li>');
    expect(page.nested.list[2]).html('<li>C</li>');
    expect(fragment).html('<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.list).eql([]);
    expect(fragment).html('<ul></ul>');
  });

  it('Component `as-array` property', function() {
    var app = derby.createApp();
    app.views.register('Body',
      '<ul>' +
        '{{each _page.items}}' +
          '<view is="item" as-array="nested.list">' +
            '{{this.text}}' +
          '</view>' +
        '{{/each}}' +
      '</ul>'
    );
    app.views.register('item', '<li>{{@content}}</li>');
    function Item() {};
    app.component('item', Item);
    var page = app.createPage();
    page.model.set('_page.items', [
      {id: 'a', text: 'A'},
      {id: 'b', text: 'B'},
      {id: 'c', text: 'C'}
    ]);
    var fragment = page.getFragment('Body');

    expect(page.nested.list).an('array');
    expect(page.nested.list).length(3);
    expect(page.nested.list[0]).instanceof(Item);
    expect(page.nested.list[1]).instanceof(Item);
    expect(page.nested.list[2]).instanceof(Item);
    expect(page.nested.list[0].markerNode.nextSibling).html('<li>A</li>');
    expect(page.nested.list[1].markerNode.nextSibling).html('<li>B</li>');
    expect(page.nested.list[2].markerNode.nextSibling).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.list).length(2);
    expect(page.nested.list[0]).instanceof(Item);
    expect(page.nested.list[1]).instanceof(Item);
    expect(page.nested.list[0].markerNode.nextSibling).html('<li>A</li>');
    expect(page.nested.list[1].markerNode.nextSibling).html('<li>C</li>');
    expect(fragment).html('<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.list).length(3);
    expect(page.nested.list[0]).instanceof(Item);
    expect(page.nested.list[1]).instanceof(Item);
    expect(page.nested.list[2]).instanceof(Item);
    expect(page.nested.list[0].markerNode.nextSibling).html('<li>D</li>');
    expect(page.nested.list[1].markerNode.nextSibling).html('<li>A</li>');
    expect(page.nested.list[2].markerNode.nextSibling).html('<li>C</li>');
    expect(fragment).html('<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.list).eql([]);
    expect(fragment).html('<ul></ul>');
  });
});
