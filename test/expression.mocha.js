var testUtil = require('racer/test/util');
var expect = testUtil.expect;
var expressions = require('../lib/expressions');

describe('expression resolution', function() {

  var context = new expressions.Context(null, {
    _page: {
      color: {
        name: 'green'
      , hex: '#0f0'
      }
    }
  });

  it('resolves a simple path expression', function() {
    var expression = expressions.createPathExpression('_page.color');
    expect(expression.resolve(context)).to.eql(['_page', 'color']);
  });

  it('resolves a `this` path expression', function() {
    var expression = expressions.createPathExpression('this');
    expect(expression.resolve(context)).to.eql([]);
    var pageExpression = expressions.createPathExpression('_page');
    var childContext = context.child(pageExpression);
    expect(expression.resolve(childContext)).to.eql(['_page']);
  });

  it('resolves a relative path expression', function() {
    var expression = expressions.createPathExpression('this.color');
    var expression2 = expressions.createPathExpression('.color');
    expect(expression.resolve(context)).to.eql(['color']);
    expect(expression2.resolve(context)).to.eql(['color']);
    var pageExpression = expressions.createPathExpression('_page');
    var childContext = context.child(pageExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'color']);
    expect(expression2.resolve(childContext)).to.eql(['_page', 'color']);
  });

  it('resolves an alias path expression', function() {
    var expression = expressions.createPathExpression(':color');
    var expression2 = expressions.createPathExpression(':color.name');
    var colorExpression = expressions.createPathExpression('_page.color');
    var childContext = context.child(colorExpression, ':color');
    expect(expression.resolve(childContext)).to.eql(['_page', 'color']);
    expect(expression2.resolve(childContext)).to.eql(['_page', 'color', 'name']);
  });

});
