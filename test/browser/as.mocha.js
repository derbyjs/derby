var expect = require('chai').expect;
var util = require('./util');
var derby = util.derby;
var expectHtml = util.expectHtml;

describe('as', function() {
  it('HTML element `as` property', function() {
    var app = derby.createApp();
    app.views.register('Body', '<div as="nested[0]"></div>');
    var page = app.createPage();
    var fragment = page.getFragment('Body');
    expectHtml(page.nested[0], '<div></div>');
    expectHtml(fragment, '<div></div>');
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
    expectHtml(page.nested[0].markerNode.nextSibling, '<div></div>');
    expectHtml(fragment, '<div></div>');
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
    expectHtml(page.nested.map.a, '<li>A</li>');
    expectHtml(page.nested.map.b, '<li>B</li>');
    expectHtml(page.nested.map.c, '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.map).all.keys('a', 'c');
    expectHtml(page.nested.map.a, '<li>A</li>');
    expectHtml(page.nested.map.c, '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.map).all.keys('a', 'c', 'd');
    expectHtml(page.nested.map.a, '<li>A</li>');
    expectHtml(page.nested.map.c, '<li>C</li>');
    expectHtml(page.nested.map.d, '<li>D</li>');
    expectHtml(fragment, '<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.map).eql({});
    expectHtml(fragment, '<ul></ul>');
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
    expectHtml(page.nested.map.a.markerNode.nextSibling, '<li>A</li>');
    expectHtml(page.nested.map.b.markerNode.nextSibling, '<li>B</li>');
    expectHtml(page.nested.map.c.markerNode.nextSibling, '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.map).all.keys('a', 'c');
    expect(page.nested.map.a).instanceof(Item);
    expect(page.nested.map.c).instanceof(Item);
    expectHtml(page.nested.map.a.markerNode.nextSibling, '<li>A</li>');
    expectHtml(page.nested.map.c.markerNode.nextSibling, '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.map).all.keys('a', 'c', 'd');
    expect(page.nested.map.a).instanceof(Item);
    expect(page.nested.map.c).instanceof(Item);
    expect(page.nested.map.d).instanceof(Item);
    expectHtml(page.nested.map.a.markerNode.nextSibling, '<li>A</li>');
    expectHtml(page.nested.map.c.markerNode.nextSibling, '<li>C</li>');
    expectHtml(page.nested.map.d.markerNode.nextSibling, '<li>D</li>');
    expectHtml(fragment, '<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.map).eql({});
    expectHtml(fragment, '<ul></ul>');
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
    expectHtml(page.nested.list[0], '<li>A</li>');
    expectHtml(page.nested.list[1], '<li>B</li>');
    expectHtml(page.nested.list[2], '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.list).length(2);
    expectHtml(page.nested.list[0], '<li>A</li>');
    expectHtml(page.nested.list[1], '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.list).length(3);
    expectHtml(page.nested.list[0], '<li>D</li>');
    expectHtml(page.nested.list[1], '<li>A</li>');
    expectHtml(page.nested.list[2], '<li>C</li>');
    expectHtml(fragment, '<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.list).eql([]);
    expectHtml(fragment, '<ul></ul>');
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
    expectHtml(page.nested.list[0].markerNode.nextSibling, '<li>A</li>');
    expectHtml(page.nested.list[1].markerNode.nextSibling, '<li>B</li>');
    expectHtml(page.nested.list[2].markerNode.nextSibling, '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>B</li><li>C</li></ul>');

    page.model.remove('_page.items', 1);
    expect(page.nested.list).length(2);
    expect(page.nested.list[0]).instanceof(Item);
    expect(page.nested.list[1]).instanceof(Item);
    expectHtml(page.nested.list[0].markerNode.nextSibling, '<li>A</li>');
    expectHtml(page.nested.list[1].markerNode.nextSibling, '<li>C</li>');
    expectHtml(fragment, '<ul><li>A</li><li>C</li></ul>');

    page.model.unshift('_page.items', {id: 'd', text: 'D'});
    expect(page.nested.list).length(3);
    expect(page.nested.list[0]).instanceof(Item);
    expect(page.nested.list[1]).instanceof(Item);
    expect(page.nested.list[2]).instanceof(Item);
    expectHtml(page.nested.list[0].markerNode.nextSibling, '<li>D</li>');
    expectHtml(page.nested.list[1].markerNode.nextSibling, '<li>A</li>');
    expectHtml(page.nested.list[2].markerNode.nextSibling, '<li>C</li>');
    expectHtml(fragment, '<ul><li>D</li><li>A</li><li>C</li></ul>');

    page.model.del('_page.items');
    expect(page.nested.list).eql([]);
    expectHtml(fragment, '<ul></ul>');
  });
});
