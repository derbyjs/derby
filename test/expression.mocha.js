var testUtil = require('racer/test/util');
var expect = testUtil.expect;
var expressions = require('../lib/expressions');

var fns = {
  plus: {
    get: function(a, b) {
      return a + b;
    }
  }
, minus: {
    get: function(a, b) {
      return a - b;
    }
  }
, greeting: {
    get: function() {
      return 'Hi.'
    }
  }
}
var contextMeta = new expressions.ContextMeta(fns);

var context = new expressions.Context(null, {
  _colors: {
    green: {
      name: 'Green'
    , hex: '#0f0'
    , rgb: [0, 255, 0]
    , light: {
        hex: '#90ee90'
      }
    , dark: {
        hex: '#006400'
      }
    }
  }
, _key: 'green'
, _channel: 0
, _variation: 'light'
, _variationHex: 'light.hex'
, _keys: ['red', 'green']
, _index: 1

, _nums: [2, 11, 3, 7]
, _first: 2
, _second: 3

}, contextMeta);

describe('Expression::resolve', function() {

  it('resolves a simple path expression', function() {
    var expression = expressions.createPathExpression('_colors.green.name');
    expect(expression.resolve(context)).to.eql(['_colors', 'green', 'name']);
  });

  it('resolves a `this` path expression', function() {
    var expression = expressions.createPathExpression('this');
    expect(expression.resolve(context)).to.eql([]);
    var withExpression = expressions.createPathExpression('_colors');
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_colors']);
  });

  it('resolves a relative path expression', function() {
    var expression = expressions.createPathExpression('this.green');
    var expression2 = expressions.createPathExpression('.green');
    expect(expression.resolve(context)).to.eql(['green']);
    expect(expression2.resolve(context)).to.eql(['green']);
    var withExpression = expressions.createPathExpression('_colors');
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_colors', 'green']);
    expect(expression2.resolve(childContext)).to.eql(['_colors', 'green']);
  });

  it('resolves an alias path expression', function() {
    var expression = expressions.createPathExpression(':color');
    var expression2 = expressions.createPathExpression(':color.name');
    var withExpression = expressions.createPathExpression('_colors.green');
    var childContext = context.child(withExpression, ':color');
    expect(expression.resolve(childContext)).to.eql(['_colors', 'green']);
    expect(expression2.resolve(childContext)).to.eql(['_colors', 'green', 'name']);
  });

  it('resolves simple square brackets expressions', function() {
    var expression = expressions.createPathExpression('_colors[_key]');
    var expression2 = expressions.createPathExpression('_colors[_key].name');
    var expression3 = expressions.createPathExpression('[_key]');
    var expression4 = expressions.createPathExpression('[_key].name');
    expect(expression.resolve(context)).to.eql(['_colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['_colors', 'green', 'name']);
    expect(expression3.resolve(context)).to.eql(['green']);
    expect(expression4.resolve(context)).to.eql(['green', 'name']);
  });

  it('resolves sibling square brackets', function() {
    var expression = expressions.createPathExpression('_colors[_key].rgb[_channel]');
    var expression2 = expressions.createPathExpression('_colors[_key][_variation]');
    var expression3 = expressions.createPathExpression('_colors[_key][_variation].hex');
    var expression4 = expressions.createPathExpression('_colors[_key][_variationHex]');
    expect(expression.resolve(context)).to.eql(['_colors', 'green', 'rgb', '0']);
    expect(expression2.resolve(context)).to.eql(['_colors', 'green', 'light']);
    expect(expression3.resolve(context)).to.eql(['_colors', 'green', 'light', 'hex']);
    expect(expression4.resolve(context)).to.eql(['_colors', 'green', 'light', 'hex']);
  });

  it('resolves nested square brackets', function() {
    var expression = expressions.createPathExpression('_colors[_keys[_index]]');
    var expression2 = expressions.createPathExpression('_colors[_keys[_index]].name');
    expect(expression.resolve(context)).to.eql(['_colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['_colors', 'green', 'name']);
  });

});

describe('Expression::get', function() {

  it('gets a simple path expression', function() {
    var expression = expressions.createPathExpression('_colors.green.name');
    expect(expression.get(context)).to.eql('Green');
  });

  it('gets a relative path expression', function() {
    var expression = expressions.createPathExpression('.green.name');
    var withExpression = expressions.createPathExpression('_colors');
    var childContext = context.child(withExpression);
    expect(expression.get(childContext)).to.eql('Green');
  });

  it('gets an alias path expression', function() {
    var expression = expressions.createPathExpression(':color.name');
    var withExpression = expressions.createPathExpression('_colors.green');
    var childContext = context.child(withExpression, ':color');
    expect(expression.get(childContext)).to.eql('Green');
  });

  it('gets a square brackets expression', function() {
    var expression = expressions.createPathExpression('_colors[_key].name');
    var expression2 = expressions.createPathExpression('_colors[_key][_variation].hex');
    expect(expression.get(context)).to.eql('Green');
    expect(expression2.get(context)).to.eql('#90ee90');
  });

  it('gets an fn expression', function() {
    var expression = expressions.createPathExpression('plus(_nums.0, _nums.1)');
    expect(expression.get(context)).to.eql(13);
  });

  it('gets an fn expression with no args', function() {
    var expression = expressions.createPathExpression('greeting()');
    expect(expression.get(context)).to.eql('Hi.');
  });

  it('gets an fn expression with relative paths', function() {
    var expression = expressions.createPathExpression('plus(.0, .1)');
    var withExpression = expressions.createPathExpression('_nums');
    var childContext = context.child(withExpression);
    expect(expression.get(childContext)).to.eql(13);
  });

  it('gets an fn expression with alias paths', function() {
    var expression = expressions.createPathExpression('plus(:nums.1, :nums.2)');
    var withExpression = expressions.createPathExpression('_nums');
    var childContext = context.child(withExpression, ':nums');
    expect(expression.get(childContext)).to.eql(14);
  });

  it('gets an fn expression containing bracket paths', function() {
    var expression = expressions.createPathExpression('plus(_nums[_first], _nums[_second])');
    expect(expression.get(context)).to.eql(10);
  });

  it('gets a bracket path containing an fn expression', function() {
    var expression = expressions.createPathExpression('_keys[minus(_nums.2, _nums.0)]');
    expect(expression.get(context)).to.eql('green');
  });

  it('gets nested fn expressions', function() {
    var expression = expressions.createPathExpression('plus(_nums.0, minus(_nums.3, _nums.2))');
    var expression2 = expressions.createPathExpression('plus(minus(_nums.3, _nums.2), _nums.1)');
    expect(expression.get(context)).to.eql(6);
    expect(expression2.get(context)).to.eql(15);
  });

});

describe('Expression::dependencies', function() {

  it('gets simple path dependencies', function() {
    var expression = expressions.createPathExpression('_colors.green.name');
    expect(expression.dependencies(context)).to.eql([['_colors', 'green', 'name']]);
  });

  it('gets bracket dependencies', function() {
    var expression = expressions.createPathExpression('_colors[_key].name');
    var expression2 = expressions.createPathExpression('_colors[_key].rgb[_channel]');
    var expression3 = expressions.createPathExpression('_colors[_key][_variation].hex');
    var expression4 = expressions.createPathExpression('_colors[_keys[_index]].name');
    expect(expression.dependencies(context)).to.eql([
      ['_colors', 'green', 'name']
    , ['_key']
    ]);
    expect(expression2.dependencies(context)).to.eql([
      ['_colors', 'green', 'rgb', '0']
    , ['_key']
    , ['_channel']
    ]);
    expect(expression3.dependencies(context)).to.eql([
      ['_colors', 'green', 'light', 'hex']
    , ['_key']
    , ['_variation']
    ]);
    expect(expression4.dependencies(context)).to.eql([
      ['_colors', 'green', 'name']
    , ['_keys', '1']
    , ['_index']
    ]);
  });

  it('gets fn dependencies');

});
