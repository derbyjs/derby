var testUtil = require('racer/test/util');
var Model = require('racer').Model;
var expect = testUtil.expect;
var expressions = require('../lib/expressions');
var createPathExpression = require('../lib/createPathExpression');
var templates = require('../lib/templates');
var fns = require('../lib/defaultFns');

fns.plus = {
  get: function(a, b) {
    return a + b;
  }
};
fns.minus = {
  get: function(a, b) {
    return a - b;
  }
};
fns.greeting = {
  get: function() {
    return 'Hi.'
  }
};
var contextMeta = new expressions.ContextMeta({fns: fns});
var data = {
  _page: {
    colors: {
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
  , key: 'green'
  , channel: 0
  , variation: 'light'
  , variationHex: 'light.hex'
  , keys: ['red', 'green']
  , index: 1

  , nums: [2, 11, 3, 7]
  , first: 2
  , second: 3
  }
};
var objectModel = new expressions.ObjectModel(data);
var context = new expressions.Context(contextMeta, objectModel);
var model = new Model();
model.setEach('_page', data._page);
var modelContext = new expressions.Context(contextMeta, model);

describe('Expression::resolve', function() {

  it('resolves a simple path expression', function() {
    var expression = createPathExpression('_page.colors.green.name');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves a `this` path expression', function() {
    var expression = createPathExpression('this');
    expect(expression.resolve(context)).to.eql([]);
    var withExpression = createPathExpression('_page.colors');
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'colors']);
  });

  it('resolves a relative path expression', function() {
    var expression = createPathExpression('this.green');
    expect(expression.resolve(context)).to.eql(['green']);
    var withExpression = createPathExpression('_page.colors');
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'colors', 'green']);
  });

  it('resolves an alias path expression', function() {
    var expression = createPathExpression('#color');
    var expression2 = createPathExpression('#color.name');
    var withExpression = createPathExpression('_page.colors.green');
    withExpression.as = '#color';
    var childContext = context.child(withExpression);
    expect(expression.resolve(childContext)).to.eql(['_page', 'colors', 'green']);
    expect(expression2.resolve(childContext)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves simple square brackets expressions', function() {
    var expression = createPathExpression('_page.colors[_page.key]');
    var expression2 = createPathExpression('_page.colors[_page.key].name');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves sibling square brackets', function() {
    var expression = createPathExpression('_page.colors[_page.key].rgb[_page.channel]');
    var expression2 = createPathExpression('_page.colors[_page.key][_page.variation]');
    var expression3 = createPathExpression('_page.colors[_page.key][_page.variation].hex');
    var expression4 = createPathExpression('_page.colors[_page.key][_page.variationHex]');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green', 'rgb', 0]);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'light']);
    expect(expression3.resolve(context)).to.eql(['_page', 'colors', 'green', 'light', 'hex']);
    expect(expression4.resolve(context)).to.eql(['_page', 'colors', 'green', 'light', 'hex']);
  });

  it('resolves nested square brackets', function() {
    var expression = createPathExpression('_page.colors[_page.keys[_page.index]]');
    var expression2 = createPathExpression('_page.colors[_page.keys[_page.index]].name');
    expect(expression.resolve(context)).to.eql(['_page', 'colors', 'green']);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'name']);
  });

  it('resolves literal properties in square brackets', function() {
    var expression = createPathExpression('_page.nums[0]');
    var expression2 = createPathExpression('_page["colors"]["green"].hex');
    expect(expression.resolve(context)).to.eql(['_page', 'nums', 0]);
    expect(expression2.resolve(context)).to.eql(['_page', 'colors', 'green', 'hex']);
  });

});

describe('Expression::get', function() {

  describe('object context', function() {
    getTests(context);
  });
  describe('model context', function() {
    getTests(modelContext);
  });

  function getTests(context) {
    it('gets a simple path expression', function() {
      var expression = createPathExpression('_page.colors.green.name');
      expect(expression.get(context)).to.equal('Green');
    });

    it('gets a relative path expression', function() {
      var expression = createPathExpression('this.green.name');
      var withExpression = createPathExpression('_page.colors');
      var childContext = context.child(withExpression);
      expect(expression.get(childContext)).to.equal('Green');
    });

    it('gets an alias path expression', function() {
      var expression = createPathExpression('#color.name');
      var withExpression = createPathExpression('_page.colors.green');
      withExpression.as = '#color';
      var childContext = context.child(withExpression);
      expect(expression.get(childContext)).to.equal('Green');
    });

    it('gets a square brackets expression', function() {
      var expression = createPathExpression('_page.colors[_page.key].name');
      var expression2 = createPathExpression('_page.colors[_page.key][_page.variation].hex');
      expect(expression.get(context)).to.equal('Green');
      expect(expression2.get(context)).to.equal('#90ee90');
    });

    it('gets an fn expression', function() {
      var expression = createPathExpression('plus(_page.nums[0], _page.nums[1])');
      expect(expression.get(context)).to.equal(13);
    });

    it('gets an fn expression with no args', function() {
      var expression = createPathExpression('greeting()');
      expect(expression.get(context)).to.equal('Hi.');
    });

    it('gets an fn expression with relative paths', function() {
      var expression = createPathExpression('plus(this[0], this[1])');
      var withExpression = createPathExpression('_page.nums');
      var childContext = context.child(withExpression);
      expect(expression.get(childContext)).to.equal(13);
    });

    it('gets an fn expression with alias paths', function() {
      var expression = createPathExpression('plus(#nums[1], #nums[2])');
      var withExpression = createPathExpression('_page.nums');
      withExpression.as = '#nums';
      var childContext = context.child(withExpression);
      expect(expression.get(childContext)).to.equal(14);
    });

    it('gets an fn expression containing bracket paths', function() {
      var expression = createPathExpression('plus(_page.nums[_page.first], _page.nums[_page.second])');
      expect(expression.get(context)).to.equal(10);
    });

    it('gets a bracket path containing an fn expression', function() {
      var expression = createPathExpression('_page.keys[minus(_page.nums[2], _page.nums[0])]');
      expect(expression.get(context)).to.equal('green');
    });

    it('gets nested fn expressions', function() {
      var expression = createPathExpression('plus(_page.nums[0], minus(_page.nums[3], _page.nums[2]))');
      var expression2 = createPathExpression('plus(minus(_page.nums[3], _page.nums[2]), _page.nums[1])');
      expect(expression.get(context)).to.equal(6);
      expect(expression2.get(context)).to.equal(15);
    });

    it('gets literal values', function() {
      // Numbers
      expect(createPathExpression('0').get()).equal(0);
      expect(createPathExpression('1.5').get()).equal(1.5);
      expect(createPathExpression('1.1e3').get()).equal(1100);
      expect(createPathExpression('0xff').get()).equal(255);
      // Booleans
      expect(createPathExpression('true').get()).equal(true);
      expect(createPathExpression('false').get()).equal(false);
      // Strings
      expect(createPathExpression('""').get()).equal('');
      expect(createPathExpression("'Howdy'").get()).equal('Howdy');
      // Regular Expressions
      var re = createPathExpression('/([0-9]+)/').get();
      expect(re).to.be.a(RegExp);
      expect(re.source).equal('([0-9]+)');
      // Other
      expect(createPathExpression('null').get()).equal(null);
    });

    it('gets `undefined` as a literal', function() {
      // `undefined` is a top-level property in JavaScript, but esprima-derby
      // parses it as a literal like `null` instead
      expect(createPathExpression('undefined').get()).equal(undefined);
    });

    it('gets literals modified by a unary operator', function() {
      expect(createPathExpression('!null').get()).equal(true);
      expect(createPathExpression('-2.3').get()).equal(-2.3);
      expect(createPathExpression('+"4"').get()).equal(4);
      expect(createPathExpression('~0').get()).equal(-1);
      expect(createPathExpression('typeof 0').get()).equal('number');
    });

    it('gets literals modified by nested unary operators', function() {
      // Nested unary operators
      expect(createPathExpression('~-1').get()).equal(0);
      expect(createPathExpression('typeof !!""').get()).equal('boolean');
    });

    it('gets literals modified by a boolean operator', function() {
      expect(createPathExpression('false || null').get()).equal(null);
      expect(createPathExpression('"" && 3').get()).equal("");
      expect(createPathExpression('1 + 1').get()).equal(2);
      expect(createPathExpression('4 - 3').get()).equal(1);
      expect(createPathExpression('1 > 0').get()).equal(true);
    });

    it('gets literals modified by nested boolean expressions', function() {
      expect(createPathExpression('2*2*2*2').get()).equal(16);
      expect(createPathExpression('true && true && 0 && true').get()).equal(0);
    });

    it('gets literals modified by a conditional operator', function() {
      expect(createPathExpression('(true) ? "yes" : "no"').get()).equal('yes');
      expect(createPathExpression('0 ? "yes" : "no"').get()).equal('no');
    });

    it('gets literals modified in mixed nested operators', function() {
      expect(createPathExpression('(1 < 0) ? null : (2 == "2") ? !!23 : false').get()).equal(true);
    });

    it('gets expressions modified by a unary operator', function() {
      var expression = createPathExpression('!_page.first');
      expect(expression.get(context)).to.equal(false);
      var expression = createPathExpression('!!_page.colors[_page.key].name');
      expect(expression.get(context)).to.equal(true);
      var expression = createPathExpression('typeof greeting()');
      expect(expression.get(context)).to.equal('string');
    });

    it('gets expressions modified by a boolean operator', function() {
      var expression = createPathExpression('_page.nums[0] + _page.nums[1]');
      expect(expression.get(context)).to.equal(13);
    });

    it('gets expressions modified by a conditional operator', function() {
      var expression = createPathExpression('(_page.key === "green") ? _page.colors.green.name : "Other"');
      expect(expression.get(context)).to.equal("Green");
    });

    it('gets array literals', function() {
      expect(createPathExpression('[]').get()).eql([]);
      expect(createPathExpression('[0, 2, 1]').get()).eql([0, 2, 1]);
      expect(createPathExpression('[[0, 1], [1, 0]]').get()).eql([[0, 1], [1, 0]]);
    });

    it('gets object literals', function() {
      expect(createPathExpression('{}').get()).eql({});
      expect(createPathExpression('{foo: 0, bar: 1}').get()).eql({foo: 0, bar: 1});
      expect(createPathExpression('{foo: 0, bar: {"!": "baz"}}').get()).eql({foo: 0, bar: {'!': 'baz'}});
    });

    it('gets nested array and object literals', function() {
      expect(createPathExpression('[{arr: [{}, {}]}, []]').get()).eql([{arr: [{}, {}]}, []]);
    });

    it('gets array literals containing paths', function() {
      var expression = createPathExpression('[_page.nums[0], 99, [_page.nums[1]], 13]');
      expect(expression.get(context)).to.eql([2, 99, [11], 13]);
    });

    it('gets object literals containing paths', function() {
      var expression = createPathExpression('{foo: _page.nums[0], bar: {"!": _page.nums[1], baz: "Hi"}}');
      expect(expression.get(context)).to.eql({foo: 2, bar: {'!': 11, baz: 'Hi'}});
    });
  }

});

describe.skip('Expression::dependencies', function() {

  it('gets simple path dependencies', function() {
    var expression = createPathExpression('_page.colors.green.name');
    expect(expression.dependencies(context)).to.eql([['_page', 'colors', 'green', 'name']]);
  });

  it('gets bracket dependencies', function() {
    var expression = createPathExpression('_page.colors[_page.key].name');
    var expression2 = createPathExpression('_page.colors[_page.key].rgb[_page.channel]');
    var expression3 = createPathExpression('_page.colors[_page.key][_page.variation].hex');
    var expression4 = createPathExpression('_page.colors[_page.keys[_page.index]].name');
    expect(expression.dependencies(context)).to.eql([
      ['_page', 'colors', 'green', 'name']
    , ['_page', 'key']
    ]);
    expect(expression2.dependencies(context)).to.eql([
      ['_page', 'colors', 'green', 'rgb', 0]
    , ['_page', 'channel']
    , ['_page', 'key']
    ]);
    expect(expression3.dependencies(context)).to.eql([
      ['_page', 'colors', 'green', 'light', 'hex']
    , ['_page', 'variation']
    , ['_page', 'key']
    ]);
    expect(expression4.dependencies(context)).to.eql([
      ['_page', 'colors', 'green', 'name']
    , ['_page', 'keys', 1]
    , ['_page', 'index']
    ]);
  });

  it('gets fn dependencies', function() {
    var expression = createPathExpression('plus(_page.nums[0], _page.nums[1])');
    var expression2 = createPathExpression('plus(_page.nums[0], minus(_page.nums[3], _page.nums[2]))');
    var expression3 = createPathExpression('plus(_page.nums[_page.first], _page.nums[_page.second])');
    var expression4 = createPathExpression('_page.keys[minus(_page.nums[2], _page.nums[0])]');
    expect(expression.dependencies(context)).to.eql([
      ['_page', 'nums', 0, '*']
    , ['_page', 'nums', 1, '*']
    ]);
    expect(expression2.dependencies(context)).to.eql([
      ['_page', 'nums', 0, '*']
    , ['_page', 'nums', 3, '*']
    , ['_page', 'nums', 2, '*']
    ]);
    expect(expression3.dependencies(context)).to.eql([
      ['_page', 'nums', 2, '*']
    , ['_page', 'first']
    , ['_page', 'nums', 3, '*']
    , ['_page', 'second']
    ]);
    expect(expression4.dependencies(context)).to.eql([
      ['_page', 'keys', 1]
    , ['_page', 'nums', 2, '*']
    , ['_page', 'nums', 0, '*']
    ]);
  });

  it('gets literal dependencies', function() {
    var expression = createPathExpression('34');
    expect(expression.dependencies(context)).to.equal(undefined);
  });

  it('gets dependencies of operators on paths', function() {
    var expression = createPathExpression('_page.nums[0] + _page.nums[1]');
    var expression2 = createPathExpression('_page.nums[0] + (_page.nums[3] - _page.nums[2])');
    var expression3 = createPathExpression('_page.nums[_page.first] + _page.nums[_page.second]');
    var expression4 = createPathExpression('_page.keys[_page.nums[2] - _page.nums[0]]');
    expect(expression.dependencies(context)).to.eql([
      ['_page', 'nums', 0, '*']
    , ['_page', 'nums', 1, '*']
    ]);
    expect(expression2.dependencies(context)).to.eql([
      ['_page', 'nums', 0, '*']
    , ['_page', 'nums', 3, '*']
    , ['_page', 'nums', 2, '*']
    ]);
    expect(expression3.dependencies(context)).to.eql([
      ['_page', 'nums', 2, '*']
    , ['_page', 'first']
    , ['_page', 'nums', 3, '*']
    , ['_page', 'second']
    ]);
    expect(expression4.dependencies(context)).to.eql([
      ['_page', 'keys', 1]
    , ['_page', 'nums', 2, '*']
    , ['_page', 'nums', 0, '*']
    ]);
  });

  it('gets dependencies of operators on mixed literals and paths', function() {
    var expression = createPathExpression('_page.nums[0] + 3');
    var expression2 = createPathExpression('_page.nums[0] + (100 - _page.nums[2])');
    var expression3 = createPathExpression('_page.nums[2] + _page.nums[_page.second]');
    var expression4 = createPathExpression('_page.keys[_page.nums[2] - 2]');
    expect(expression.dependencies(context)).to.eql([
      ['_page', 'nums', 0, '*']
    ]);
    expect(expression2.dependencies(context)).to.eql([
      ['_page', 'nums', 0, '*']
    , ['_page', 'nums', 2, '*']
    ]);
    expect(expression3.dependencies(context)).to.eql([
      ['_page', 'nums', 2, '*']
    , ['_page', 'nums', 3, '*']
    , ['_page', 'second']
    ]);
    expect(expression4.dependencies(context)).to.eql([
      ['_page', 'keys', 1]
    , ['_page', 'nums', 2, '*']
    ]);
  });

});

describe('Expression::truthy', function() {

  it('gets standard truthy value for if block', function() {
    expect(templates.createExpression('if false').truthy()).equal(false);
    expect(templates.createExpression('if undefined').truthy()).equal(false);
    expect(templates.createExpression('if null').truthy()).equal(false);
    expect(templates.createExpression('if ""').truthy()).equal(false);
    expect(templates.createExpression('if []').truthy()).equal(false);

    expect(templates.createExpression('if true').truthy()).equal(true);
    expect(templates.createExpression('if 0').truthy()).equal(true);
    expect(templates.createExpression('if 1').truthy()).equal(true);
    expect(templates.createExpression('if "Hi"').truthy()).equal(true);
    expect(templates.createExpression('if [0]').truthy()).equal(true);
    expect(templates.createExpression('if {}').truthy()).equal(true);
    expect(templates.createExpression('if {foo: 0}').truthy()).equal(true);
  });

  it('gets inverse truthy value for unless block', function() {
    expect(templates.createExpression('unless false').truthy()).equal(true);
    expect(templates.createExpression('unless undefined').truthy()).equal(true);
    expect(templates.createExpression('unless null').truthy()).equal(true);
    expect(templates.createExpression('unless ""').truthy()).equal(true);
    expect(templates.createExpression('unless []').truthy()).equal(true);

    expect(templates.createExpression('unless true').truthy()).equal(false);
    expect(templates.createExpression('unless 0').truthy()).equal(false);
    expect(templates.createExpression('unless 1').truthy()).equal(false);
    expect(templates.createExpression('unless "Hi"').truthy()).equal(false);
    expect(templates.createExpression('unless [0]').truthy()).equal(false);
    expect(templates.createExpression('unless {}').truthy()).equal(false);
    expect(templates.createExpression('unless {foo: 0}').truthy()).equal(false);
  });

  it('gets always truthy value for else block', function() {
    templates.createExpression('else')
    expect(templates.createExpression('else').truthy()).equal(true);
  });

});
