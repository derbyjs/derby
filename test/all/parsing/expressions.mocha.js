var expect = require('chai').expect;
var derbyTemplates = require('../../../src/templates');
var contexts = derbyTemplates.contexts;
var expressions = derbyTemplates.expressions;
var create = require('../../../src/parsing/createPathExpression').createPathExpression;

var controller = {
  plus: function(a, b) {
    return a + b;
  },
  minus: function(a, b) {
    return a - b;
  },
  greeting: function() {
    return 'Hi.';
  },
  keys: function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    return keys;
  },
  passThrough: function(value) {
    return value;
  },
  informal: {
    greeting: function() {
      return 'Yo!';
    }
  },
  Date: Date,
  global: global
};
controller.model = {
  data: {
    key: 'green',
    _page: {
      colors: {
        green: {
          name: 'Green',
          hex: '#0f0',
          rgb: [0, 255, 0],
          light: {
            hex: '#90ee90'
          },
          dark: {
            hex: '#006400'
          }
        }
      },
      key: 'green',
      channel: 0,
      variation: 'light',
      variationHex: 'light.hex',
      keys: ['red', 'green'],
      index: 1,
      nums: [2, 11, 3, 7],
      first: 2,
      second: 3,
      date: new Date(1000)
    }
  }
};
controller.model.scope = function(path) {
  return {
    _at: path,
    path: function() {
      return this._at;
    }
  };
};
var contextMeta = new contexts.ContextMeta({});
var context = new contexts.Context(contextMeta, controller);

describe('Expression::resolve', function() {

  it('resolves a simple path expression', function() {
    var expression = create('_page.colors.green.name');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves a `this` path expression', function() {
    var expression = create('this');
    expect(expression.resolve(context)).to.eql([]);
    var withExpression = create('_page.colors');
    withExpression.meta = new expressions.ExpressionMeta();
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'colors']);
  });

  it('resolves a relative path expression', function() {
    var expression = create('this.green');
    expect(expression.resolve(context)).to.eql(['green']);
    var withExpression = create('_page.colors');
    withExpression.meta = new expressions.ExpressionMeta();
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'colors', 'green']);
  });

  it('resolves an alias path expression', function() {
    var expression = create('#color');
    var expression2 = create('#color.name');
    var withExpression = create('_page.colors.green');
    withExpression.meta = new expressions.ExpressionMeta();
    withExpression.meta.as = '#color';
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'colors', 'green']);
    expect(expression2.resolve(childContext)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves square brackets expressions with single segments', function() {
    var expression = create('colors[key]');
    var expression2 = create('colors[key].name');
    expect(expression.resolve(context)).to.eql(['colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['colors', 'green', 'name']);
  });

  it('resolves simple square brackets expressions', function() {
    var expression = create('_page.colors[_page.key]');
    var expression2 = create('_page.colors[_page.key].name');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves sibling square brackets', function() {
    var expression = create('_page.colors[_page.key].rgb[_page.channel]');
    var expression2 = create('_page.colors[_page.key][_page.variation]');
    var expression3 = create('_page.colors[_page.key][_page.variation].hex');
    var expression4 = create('_page.colors[_page.key][_page.variationHex]');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green', 'rgb', 0]);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'light']);
    expect(expression3.resolve(context)).to.eql(['_page', 'colors', 'green', 'light', 'hex']);
    expect(expression4.resolve(context)).to.eql(['_page', 'colors', 'green', 'light.hex']);
  });

  it('resolves nested square brackets', function() {
    var expression = create('_page.colors[_page.keys[_page.index]]');
    var expression2 = create('_page.colors[_page.keys[_page.index]].name');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves literal properties in square brackets', function() {
    var expression = create('_page.nums[0]');
    var expression2 = create('_page["colors"]["green"].hex');
    expect(expression.resolve(context)).to.eql(['_page', 'nums', 0]);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'hex']);
  });

});

describe('Expression::get', function() {

  it('gets a simple path expression', function() {
    var expression = create('_page.colors.green.name');
    expect(expression.get(context)).to.equal('Green');
  });

  it('gets a relative path expression', function() {
    var expression = create('this.green.name');
    var withExpression = create('_page.colors');
    withExpression.meta = new expressions.ExpressionMeta();
    var childContext = context.child(withExpression);
    expect(expression.get(childContext)).to.equal('Green');
  });

  it('gets an alias path expression', function() {
    var expression = create('#color.name');
    var withExpression = create('_page.colors.green');
    withExpression.meta = new expressions.ExpressionMeta();
    withExpression.meta.as = '#color';
    var childContext = context.child(withExpression);
    expect(expression.get(childContext)).to.equal('Green');
  });

  it('gets a square brackets expression', function() {
    var expression = create('_page.colors[_page.key].name');
    var expression2 = create('_page.colors[_page.key][_page.variation].hex');
    expect(expression.get(context)).to.equal('Green');
    expect(expression2.get(context)).to.equal('#90ee90');
  });

  it('gets an fn expression', function() {
    var expression = create('plus(_page.nums[0], _page.nums[1])');
    expect(expression.get(context)).to.equal(13);
  });

  it('gets an fn expression with no args', function() {
    var expression = create('greeting()');
    expect(expression.get(context)).to.equal('Hi.');
  });

  it('gets an fn expression on a subpath', function() {
    var expression = create('informal.greeting()');
    expect(expression.get(context)).to.equal('Yo!');
  });

  it('gets an fn expression with relative paths', function() {
    var expression = create('plus(this[0], this[1])');
    var withExpression = create('_page.nums');
    withExpression.meta = new expressions.ExpressionMeta();
    var childContext = context.child(withExpression);
    expect(expression.get(childContext)).to.equal(13);
  });

  it('gets an fn expression with alias paths', function() {
    var expression = create('plus(#nums[1], #nums[2])');
    var withExpression = create('_page.nums');
    withExpression.meta = new expressions.ExpressionMeta();
    withExpression.meta.as = '#nums';
    var childContext = context.child(withExpression);
    expect(expression.get(childContext)).to.equal(14);
  });

  it('gets a property of an fn expression', function() {
    var expression = create('keys(_page.colors)[0]');
    var expression2 = create('passThrough(_page.colors).green');
    expect(expression.get(context)).to.equal('green');
    expect(expression2.get(context)).to.equal(controller.model.data._page.colors.green);
  });

  it('gets square bracket paths of an fn expression', function() {
    var expression = create('keys(_page.colors)[_page.channel]');
    var expression2 = create('passThrough(_page.colors).green[_page.variation].hex');
    expect(expression.get(context)).to.equal('green');
    expect(expression2.get(context)).to.equal('#90ee90');
  });

  it('gets an fn expression containing bracket paths', function() {
    var expression = create('plus(_page.nums[_page.first], _page.nums[_page.second])');
    expect(expression.get(context)).to.equal(10);
  });

  it('gets a bracket path containing an fn expression', function() {
    var expression = create('_page.keys[minus(_page.nums[2], _page.nums[0])]');
    expect(expression.get(context)).to.equal('green');
  });

  it('gets nested fn expressions', function() {
    var expression = create('plus(_page.nums[0], minus(_page.nums[3], _page.nums[2]))');
    var expression2 = create('plus(minus(_page.nums[3], _page.nums[2]), _page.nums[1])');
    expect(expression.get(context)).to.equal(6);
    expect(expression2.get(context)).to.equal(15);
  });

  it('gets scoped model expressions', function() {
    var expression = create('$at(_page.nums[0])');
    expect(expression.get(context).path()).to.equal('_page.nums.0');
  });

  it('gets scoped model expressions in fn expressions', function() {
    var expression = create('passThrough($at(_page.nums[3]))');
    expect(expression.get(context).path()).to.equal('_page.nums.3');
  });

  it('gets a `new` expression without arguments', function() {
    var expression = create('new Date');
    var date = expression.get(context);
    expect(date).to.be.an.instanceOf(Date);
  });

  it('gets a `new` expression with arguments', function() {
    var expression = create('new Date(2000, 0)');
    var date = expression.get(context);
    expect(date.getFullYear()).equal(2000);
    expect(date.getMonth()).equal(0);
  });

  it('gets `new` expression on nested path', function() {
    var expression = create('new global.Error()');
    expect(expression.get(context)).to.be.an.instanceOf(Error);
  });

  // None of these are supported yet, but ideally they would be
  it.skip('gets method call of the result of an fn expressions', function() {
    var expression = create('(_page.date).valueOf()');
    expect(expression.get(context)).to.equal(1000);
  });
  it.skip('gets method call of the result of an fn expressions', function() {
    var expression = create('passThrough(_page.date).valueOf()');
    expect(expression.get(context)).to.equal(1000);
  });
  it.skip('gets method call of the result of a `new` expressions', function() {
    var expression = create('new Date(1000).valueOf()');
    expect(expression.get(context)).to.equal(1000);
  });
  it.skip('gets method call of a scoped model expression', function() {
    var expression = create('$at(_page.nums[3]).path()');
    expect(expression.get(context)).to.equal('_page.nums.3');
  });

  it('gets literal values', function() {
    // Numbers
    expect(create('0').get()).equal(0);
    expect(create('1.5').get()).equal(1.5);
    expect(create('1.1e3').get()).equal(1100);
    expect(create('0xff').get()).equal(255);
    // Booleans
    expect(create('true').get()).equal(true);
    expect(create('false').get()).equal(false);
    // Strings
    expect(create('""').get()).equal('');
    expect(create('\'Howdy\'').get()).equal('Howdy');
    // Regular Expressions
    var re = create('/([0-9]+)/').get();
    expect(re).to.be.an.instanceOf(RegExp);
    expect(re.source).equal('([0-9]+)');
    // Other
    expect(create('null').get()).equal(null);
  });

  it('gets `undefined` as a literal', function() {
    // `undefined` is a top-level property in JavaScript, but esprima-derby
    // parses it as a literal like `null` instead
    expect(create('undefined').get()).equal(void 0);
  });

  it('gets literals modified by a unary operator', function() {
    expect(create('!null').get()).equal(true);
    expect(create('-2.3').get()).equal(-2.3);
    expect(create('+"4"').get()).equal(4);
    expect(create('~0').get()).equal(-1);
    expect(create('typeof 0').get()).equal('number');
  });

  it('gets literals modified by nested unary operators', function() {
    // Nested unary operators
    expect(create('~-1').get()).equal(0);
    expect(create('typeof !!""').get()).equal('boolean');
  });

  it('gets literals modified by a boolean operator', function() {
    expect(create('false || null').get()).equal(null);
    expect(create('"" && 3').get()).equal('');
    expect(create('1 + 1').get()).equal(2);
    expect(create('4 - 3').get()).equal(1);
    expect(create('1 > 0').get()).equal(true);
  });

  it('gets literals modified by nested boolean expressions', function() {
    expect(create('2*2*2*2').get()).equal(16);
    expect(create('true && true && 0 && true').get()).equal(0);
  });

  it('gets literals modified by a conditional operator', function() {
    expect(create('(true) ? "yes" : "no"').get()).equal('yes');
    expect(create('0 ? "yes" : "no"').get()).equal('no');
  });

  it('gets literals modified in mixed nested operators', function() {
    expect(create('(1 < 0) ? null : (2 == "2") ? !!23 : false').get()).equal(true);
  });

  it('gets expressions modified by a unary operator', function() {
    var expression = create('!_page.first');
    expect(expression.get(context)).to.equal(false);
    var expression = create('!!_page.colors[_page.key].name');
    expect(expression.get(context)).to.equal(true);
    var expression = create('typeof greeting()');
    expect(expression.get(context)).to.equal('string');
  });

  it('gets expressions modified by a boolean operator', function() {
    var expression = create('_page.nums[0] + _page.nums[1]');
    expect(expression.get(context)).to.equal(13);
  });

  it('gets expressions modified by a conditional operator', function() {
    var expression = create('(_page.key === "green") ? _page.colors.green.name : "Other"');
    expect(expression.get(context)).to.equal('Green');
  });

  it('gets array literals', function() {
    expect(create('[]').get()).eql([]);
    expect(create('[0, 2, 1]').get()).eql([0, 2, 1]);
    expect(create('[[0, 1], [1, 0]]').get()).eql([[0, 1], [1, 0]]);
  });

  it('gets object literals', function() {
    expect(create('{}').get()).eql({});
    expect(create('{foo: 0, bar: 1}').get()).eql({foo: 0, bar: 1});
    expect(create('{foo: 0, bar: {"!": "baz"}}').get()).eql({foo: 0, bar: {'!': 'baz'}});
  });

  it('gets nested array and object literals', function() {
    expect(create('[{arr: [{}, {}]}, []]').get()).eql([{arr: [{}, {}]}, []]);
  });

  it('gets array literals containing paths', function() {
    var expression = create('[_page.nums[0], 99, [_page.nums[1]], 13]');
    expect(expression.get(context)).to.eql([2, 99, [11], 13]);
  });

  it('gets object literals containing paths', function() {
    var expression = create('{foo: _page.nums[0], bar: {"!": _page.nums[1], baz: "Hi"}}');
    expect(expression.get(context)).to.eql({foo: 2, bar: {'!': 11, baz: 'Hi'}});
  });

  it('gets sequence expressions containing paths', function() {
    var expression = create('_page.nums[0], 5, _page.nums[1]');
    expect(expression.get(context)).to.eql(11);
  });

  it('gets a property of a sequence expression', function() {
    var expression = create('(null, _page.colors).green.name');
    expect(expression.get(context)).to.eql('Green');
  });

});
