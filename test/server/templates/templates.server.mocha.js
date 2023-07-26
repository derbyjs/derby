var expect = require('chai').expect;
var templates = require('../../../dist/templates/templates');
var expressions = require('../../../dist/templates/expressions');

function test(createTemplate) {
  return function() {
    var serialized = createTemplate().serialize();
    var expected = createTemplate.toString()
      .replace(/,\n\s*/g, ', ')
      // Remove leading & trailing whitespace and newlines
      .replace(/\s*\r?\n\s*/g, '')
      // Remove the wrapping function boilerplate
      .replace(/^function\s*\(\)\s*\{return (.*?);?}$/, '$1');
    expect(serialized).equal(expected);
  };
}

describe('Block::serialize', function() {
  it('serializes without arguments', test(function() {
    return new templates.Block();
  }));
  it('serializes content', test(function() {
    return new templates.Block(null, [new templates.Element('div')]);
  }));
});

describe('Text::serialize', function() {
  it('serializes', test(function() {
    return new templates.Text('test');
  }));
});

describe('Comment::serialize', function() {
  it('serializes', test(function() {
    return new templates.Comment('test\'');
  }));
});

describe('Element::serialize', function() {
  it('serializes tagName only', test(function() {
    return new templates.Element('test');
  }));
});

describe('Attribute::serialize', function() {
  it('serializes naked attribute', test(function() {
    return new templates.Attribute('test');
  }));
  it('serializes attribute in Element', test(function() {
    return new templates.Element('div', {
      'class': new templates.Attribute('post')
    });
  }));
  it('serializes attribute in nested Element', test(function() {
    return new templates.Block(null, [
      new templates.Element('div', {
        'class': new templates.Attribute('post')
      })
    ]);
  }));
});

describe('Expression::serialize', function() {
  it('serializes example expression', test(function() {
    return new expressions.Expression('test');
  }));
});

describe('ConditionalBlock::serialize', function() {
  it('serializes multiple condition block', test(function() {
    return new templates.ConditionalBlock(
      [new expressions.Expression('comments'), null],
      [
        [new templates.Element('h1', null, [new templates.Text('Comments')]), new templates.Text('')],
        [new templates.Element('h1', null, [new templates.Text('No comments')])]
      ]
    );
  }));
});

describe('EachBlock::serialize', function() {
  it('serializes each block with else', test(function() {
    return new templates.EachBlock(
      new expressions.Expression('comments'),
      [
        new templates.Element('h2', null, [
          new templates.Text('By '),
          new templates.Block(
            new expressions.Expression('nonsense'),
            [new templates.DynamicText(new expressions.Expression('author'))]
          )
        ]),
        new templates.Element('div',
          {
            'class': new templates.Attribute('body')
          },
          [new templates.DynamicText(new expressions.Expression('body'))]
        )
      ],
      [new templates.Text('Lamers')]
    );
  }));
});
