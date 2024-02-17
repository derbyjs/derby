var chai = require('chai');
var expect = chai.expect;
var saddle = require('../../../dist/templates/templates');
var domTestRunner = require('../../../dist/test-utils/domTestRunner');

describe('templates rendering', function() {
  domTestRunner.install({jsdomOptions: {pretendToBeVisual: true}});

  describe('Static rendering', function() {  
    describe('HTML', function() {
      testStaticRendering(function test(options) {
        var context = getContext();
        var html = options.template.get(context);
        expect(html).equal(options.html);
      });
    });
  
    describe('Fragment', function() {
      testStaticRendering(function test(options) {
        var context = getContext();
        // getFragment calls appendTo, so these Fragment tests cover appendTo.
        var fragment = options.template.getFragment(context);
        options.fragment(fragment);
      });
    });
  
  });
  
  describe('Dynamic rendering', function() {

    describe('HTML', function() {
      testDynamicRendering(function test(options) {
        var context = getContext({
          show: true
        });
        var html = options.template.get(context);
        expect(html).equal(options.html);
      });
    });
  
    describe('Fragment', function() {
      testDynamicRendering(function test(options) {
        var context = getContext({
          show: true
        });
        var fragment = options.template.getFragment(context);
        options.fragment(fragment);
      });
    });
  });
});

function testStaticRendering(test) {
  it('renders an empty div', function() {
    test({
      template: new saddle.Element('div'),
      html: '<div></div>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].tagName.toLowerCase()).equal('div');
      }
    });
  });

  it('renders a void element', function() {
    test({
      template: new saddle.Element('br'),
      html: '<br>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].tagName.toLowerCase()).equal('br');
      }
    });
  });

  it('renders a div with literal attributes', function() {
    test({
      template: new saddle.Element('div', {
        id: new saddle.Attribute('page'),
        'data-x': new saddle.Attribute('24'),
        'class': new saddle.Attribute('content fit')
      }),
      html: '<div id="page" data-x="24" class="content fit"></div>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].tagName.toLowerCase()).equal('div');
        expect(fragment.childNodes[0].id).equal('page');
        expect(fragment.childNodes[0].className).equal('content fit');
        expect(fragment.childNodes[0].getAttribute('data-x')).equal('24');
      }
    });
  });

  it('renders a true boolean attribute', function() {
    test({
      template: new saddle.Element('input', {
        autofocus: new saddle.Attribute(true)
      }),
      html: '<input autofocus>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].tagName.toLowerCase()).equal('input');
        expect(fragment.childNodes[0].getAttribute('autofocus')).not.eql(null);
      }
    });
  });

  it('renders a false boolean attribute', function() {
    test({
      template: new saddle.Element('input', {
        autofocus: new saddle.Attribute(false)
      }),
      html: '<input>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].tagName.toLowerCase()).equal('input');
        expect(fragment.childNodes[0].getAttribute('autofocus')).eql(null);
      }
    });
  });

  describe('title attribute', function() {
    it('renders string value', function() {
      test({
        template: new saddle.Element('div', {
          title: new saddle.Attribute('My tooltip')
        }),
        html: '<div title="My tooltip"></div>',
        fragment: function(fragment) {
          expect(fragment.childNodes.length).equal(1);
          expect(fragment.childNodes[0].tagName.toLowerCase()).equal('div');
          expect(fragment.childNodes[0].getAttribute('title')).eql('My tooltip');
        }
      });
    });

    it('renders numeric value as a string', function() {
      test({
        template: new saddle.Element('div', {
          title: new saddle.Attribute(123)
        }),
        html: '<div title="123"></div>',
        fragment: function(fragment) {
          expect(fragment.childNodes.length).equal(1);
          expect(fragment.childNodes[0].tagName.toLowerCase()).equal('div');
          expect(fragment.childNodes[0].getAttribute('title')).eql('123');
        }
      });
    });

    it('does not render undefined value', function() {
      test({
        template: new saddle.Element('div', {
          title: new saddle.Attribute(undefined)
        }),
        html: '<div></div>',
        fragment: function(fragment) {
          expect(fragment.childNodes.length).equal(1);
          expect(fragment.childNodes[0].tagName.toLowerCase()).equal('div');
          expect(fragment.childNodes[0].hasAttribute('title')).eql(false);
        }
      });
    });
  });

  it('renders nested elements', function() {
    test({
      template: new saddle.Element('div', null, [
        new saddle.Element('div', null, [
          new saddle.Element('span'),
          new saddle.Element('span')
        ])
      ]),
      html: '<div><div><span></span><span></span></div></div>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        var node = fragment.childNodes[0];
        expect(node.tagName.toLowerCase()).equal('div');
        expect(node.childNodes.length).equal(1);
        var node = node.childNodes[0];
        expect(node.tagName.toLowerCase()).equal('div');
        expect(node.childNodes.length).equal(2);
        expect(node.childNodes[0].tagName.toLowerCase()).equal('span');
        expect(node.childNodes[0].childNodes.length).equal(0);
        expect(node.childNodes[1].tagName.toLowerCase()).equal('span');
        expect(node.childNodes[1].childNodes.length).equal(0);
      }
    });
  });

  it('renders a text node', function() {
    test({
      template: new saddle.Text('Hi'),
      html: 'Hi',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].nodeType).equal(3);
        expect(fragment.childNodes[0].data).equal('Hi');
      }
    });
  });

  it('renders text nodes in an element', function() {
    test({
      template: new saddle.Element('div', null, [
        new saddle.Text('Hello, '),
        new saddle.Text('world.')
      ]),
      html: '<div>Hello, world.</div>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        var node = fragment.childNodes[0];
        expect(node.tagName.toLowerCase()).equal('div');
        expect(node.childNodes.length).equal(2);
        expect(node.childNodes[0].nodeType).equal(3);
        expect(node.childNodes[0].data).equal('Hello, ');
        expect(node.childNodes[1].nodeType).equal(3);
        expect(node.childNodes[1].data).equal('world.');
      }
    });
  });

  it('renders a comment', function() {
    test({
      template: new saddle.Comment('Hi'),
      html: '<!--Hi-->',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].nodeType).equal(8);
        expect(fragment.childNodes[0].data).equal('Hi');
      }
    });
  });

  it('renders a template', function() {
    test({
      template: new saddle.Template([
        new saddle.Comment('Hi'),
        new saddle.Element('div', null, [
          new saddle.Text('Ho')
        ])
      ]),
      html: '<!--Hi--><div>Ho</div>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(2);
        expect(fragment.childNodes[0].nodeType).equal(8);
        expect(fragment.childNodes[0].data).equal('Hi');
        var node = fragment.childNodes[1];
        expect(node.tagName.toLowerCase()).equal('div');
        expect(node.childNodes.length).equal(1);
        expect(node.childNodes[0].nodeType).equal(3);
        expect(node.childNodes[0].data).equal('Ho');
      }
    });
  });

  it('renders raw HTML', function() {
    test({
      template: new saddle.Html('<div>Hi</div><input>'),
      html: '<div>Hi</div><input>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(2);
        var node = fragment.childNodes[0];
        expect(node.tagName.toLowerCase()).equal('div');
        expect(node.innerHTML).equal('Hi');
        var node = fragment.childNodes[1];
        expect(node.tagName.toLowerCase()).equal('input');
      }
    });
  });

  it('renders <tr> from HTML within tbody context', function() {
    test({
      template: new saddle.Element('table', null, [
        new saddle.Element('tbody', null, [
          new saddle.Html('<tr><td>Hi</td></tr>')
        ])
      ]),
      html: '<table><tbody><tr><td>Hi</td></tr></tbody></table>',
      fragment: function(fragment) {
        var node = fragment.firstChild;
        expect(node.tagName.toLowerCase()).equal('table');
        node = node.firstChild;
        expect(node.tagName.toLowerCase()).equal('tbody');
        node = node.firstChild;
        expect(node.tagName.toLowerCase()).equal('tr');
        node = node.firstChild;
        expect(node.tagName.toLowerCase()).equal('td');
        expect(node.innerHTML).equal('Hi');
      }
    });
  });

  it('renders <input> value attribute', function() {
    test({
      template: new saddle.Element('input', {
        value: new saddle.Attribute('hello')
      }),
      html: '<input value="hello">',
      fragment: function(fragment) {
        expect(fragment.childNodes[0].value).equal('hello');
        expect(fragment.childNodes[0].getAttribute('value')).equal('hello');
      }
    });
  });

  it('renders <input> checked attribute: true', function() {
    test({
      template: new saddle.Element('input', {
        type: new saddle.Attribute('radio'),
        checked: new saddle.Attribute(true)
      }),
      html: '<input type="radio" checked>',
      fragment: function(fragment) {
        expect(fragment.childNodes[0].checked).equal(true);
      }
    });
  });

  it('renders <input> indeterminate attribute: true', function() {
    test({
      template: new saddle.Element('input', {
        type: new saddle.Attribute('checkbox'),
        indeterminate: new saddle.Attribute(true)
      }),
      html: '<input type="checkbox" indeterminate>',
      fragment: function(fragment) {
        expect(fragment.childNodes[0].indeterminate).equal(true);
      }
    });
  });

  it('renders <input> checked attribute: false', function() {
    test({
      template: new saddle.Element('input', {
        type: new saddle.Attribute('radio'),
        checked: new saddle.Attribute(false)
      }),
      html: '<input type="radio">',
      fragment: function(fragment) {
        expect(fragment.childNodes[0].checked).equal(false);
      }
    });
  });
}

function testDynamicRendering(test) {
  // TODO: More tests

  it('renders a template as an attribute expression', function() {
    test({
      template: new saddle.Element('div', {
        'class': new saddle.DynamicAttribute(new saddle.Template([
          new saddle.Text('dropdown'),
          new saddle.ConditionalBlock([
            new FakeExpression('show')
          ], [
            [new saddle.Text(' show')]
          ])
        ]))
      }),
      html: '<div class="dropdown show"></div>',
      fragment: function(fragment) {
        expect(fragment.childNodes.length).equal(1);
        expect(fragment.childNodes[0].tagName.toLowerCase()).equal('div');
        expect(fragment.childNodes[0].className).equal('dropdown show');
      }
    });
  });

}

describe('templates DOM manipulation', function() {
  domTestRunner.install({jsdomOptions: {pretendToBeVisual: true}});

  var fixture;
  beforeEach(function() {
    fixture = document.getElementById('fixture');
    if (!fixture) {
      fixture = document.createElement('div');
      fixture.id = 'fixture';
    }
  });

  afterEach(function() {
    removeChildren(fixture);
  });

  describe('attachTo', function() {
    function renderAndAttach(template) {
      var context = getContext();
      removeChildren(fixture);
      fixture.innerHTML = template.get(context);
      template.attachTo(fixture, fixture.firstChild, context);
    }
  
    it('splits static text nodes', function() {
      var template = new saddle.Template([
        new saddle.Text('Hi'),
        new saddle.Text(' there.')
      ]);
      renderAndAttach(template);
      expect(fixture.childNodes.length).equal(2);
    });
  
    it('splits empty static text nodes', function() {
      var template = new saddle.Template([
        new saddle.Text(''),
        new saddle.Text('')
      ]);
      renderAndAttach(template);
      expect(fixture.childNodes.length).equal(2);
    });
  
    it('splits mixed empty static text nodes', function() {
      var template = new saddle.Template([
        new saddle.Text(''),
        new saddle.Text('Hi'),
        new saddle.Text(''),
        new saddle.Text(''),
        new saddle.Text(' there.'),
        new saddle.Text('')
      ]);
      renderAndAttach(template);
      expect(fixture.childNodes.length).equal(6);
    });
  
    it('adds empty text nodes around a comment', function() {
      var template = new saddle.Template([
        new saddle.Text('Hi'),
        new saddle.Text(''),
        new saddle.Comment('cool'),
        new saddle.Comment('thing'),
        new saddle.Text('')
      ]);
      renderAndAttach(template);
      expect(fixture.childNodes.length).equal(5);
    });
  
    it('attaches to nested elements', function() {
      var template = new saddle.Template([
        new saddle.Element('ul', null, [
          new saddle.Element('li', null, [
            new saddle.Text('One')
          ]),
          new saddle.Element('li', null, [
            new saddle.Text('Two')
          ])
        ])
      ]);
      renderAndAttach(template);
    });
  
    it('attaches to element attributes', function() {
      var template = new saddle.Template([
        new saddle.Element('input', {
          type: new saddle.Attribute('text'),
          autofocus: new saddle.Attribute(true),
          placeholder: new saddle.Attribute(null)
        })
      ]);
      renderAndAttach(template);
    });
  
    it('attaches to <tr> from HTML within tbody context', function() {
      var template = new saddle.Element('table', null, [
        new saddle.Element('tbody', null, [
          new saddle.Comment('OK'),
          new saddle.Html('<tr><td>Hi</td></tr>'),
          new saddle.Element('tr', null, [
            new saddle.Element('td', null, [
              new saddle.Text('Ho')
            ])
          ])
        ])
      ]);
      renderAndAttach(template);
    });
  
    it('traverses with comments in a table and select', function() {
      // IE fails to create comments in certain locations when parsing HTML
      var template = new saddle.Template([
        new saddle.Element('table', null, [
          new saddle.Comment('table comment'),
          new saddle.Element('tbody', null, [
            new saddle.Comment('tbody comment'),
            new saddle.Element('tr', null, [
              new saddle.Element('td')
            ])
          ])
        ]),
        new saddle.Element('select', null, [
          new saddle.Comment('select comment start'),
          new saddle.Element('option'),
          new saddle.Comment('select comment inner'),
          new saddle.Element('option'),
          new saddle.Comment('select comment end'),
          new saddle.Comment('select comment end 2')
        ])
      ]);
      renderAndAttach(template);
    });
  
    it('throws when fragment does not match HTML', function() {
      // This template is invalid HTML, and when it is parsed it will produce
      // a different tree structure than when the nodes are created one-by-one
      var template = new saddle.Template([
        new saddle.Element('table', null, [
          new saddle.Element('div', null, [
            new saddle.Element('td', null, [
              new saddle.Text('Hi')
            ])
          ])
        ])
      ]);
      expect(function() {
        renderAndAttach(template);
      }).throw(Error);
    });
  
  });
  
  describe('binding updates', function() {
    describe('getFragment', function() {
      testBindingUpdates(function render(template, data) {
        var bindings = [];
        var context = getContext(data, bindings);
        var fragment = template.getFragment(context);
        removeChildren(fixture);
        fixture.appendChild(fragment);
        return bindings;
      });
    });
  
    describe('get + attachTo', function() {
      testBindingUpdates(function render(template, data) {
        var bindings = [];
        var context = getContext(data, bindings);
        removeChildren(fixture);
        fixture.innerHTML = template.get(context);
        template.attachTo(fixture, fixture.firstChild, context);
        return bindings;
      });
    });

    function testBindingUpdates(render) {
      it('updates a single TextNode', function() {
        var template = new saddle.Template([
          new saddle.DynamicText(new FakeExpression('text'))
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('');
        binding.context = getContext({text: 'Yo'});
        binding.update();
        expect(getText(fixture)).equal('Yo');
      });

      it('updates sibling TextNodes', function() {
        var template = new saddle.Template([
          new saddle.DynamicText(new FakeExpression('first')),
          new saddle.DynamicText(new FakeExpression('second'))
        ]);
        var bindings = render(template, {second: 2});
        expect(bindings.length).equal(2);
        expect(getText(fixture)).equal('2');
        var context = getContext({first: 'one', second: 'two'});
        bindings[0].context = context;
        bindings[0].update();
        expect(getText(fixture)).equal('one2');
        bindings[1].context = context;
        bindings[1].update();
        expect(getText(fixture)).equal('onetwo');
      });

      it('updates a TextNode that returns text, then a Template', function() {
        var template = new saddle.Template([
          new saddle.DynamicText(new FakeExpression('dynamicTemplate'))
        ]);
        var data = {dynamicTemplate: 'Hola'};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('Hola');
        binding.context = getContext({
          dynamicTemplate: new saddle.DynamicText(new FakeExpression('text')),
          text: 'Yo'
        });
        binding.update();
        expect(getText(fixture)).equal('Yo');
      });

      it('updates a TextNode that returns a Template, then text', function() {
        var template = new saddle.Template([
          new saddle.DynamicText(new FakeExpression('dynamicTemplate'))
        ]);
        var data = {
          dynamicTemplate: new saddle.DynamicText(new FakeExpression('text')),
          text: 'Yo'
        };
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('Yo');
        binding.context = getContext({dynamicTemplate: 'Hola'});
        binding.update();
        expect(getText(fixture)).equal('Hola');
      });

      it('updates a TextNode that returns a Template, then another Template', function() {
        var template = new saddle.Template([
          new saddle.DynamicText(new FakeExpression('dynamicTemplate'))
        ]);
        var data = {
          dynamicTemplate: new saddle.DynamicText(new FakeExpression('text')),
          text: 'Yo'
        };
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('Yo');
        binding.context = getContext({
          dynamicTemplate: new saddle.Template([
            new saddle.DynamicText(new FakeExpression('first')),
            new saddle.DynamicText(new FakeExpression('second'))
          ]),
          first: 'one',
          second: 'two'
        });
        binding.update();
        expect(getText(fixture)).equal('onetwo');
      });

      it('updates within a template returned by a TextNode', function() {
        var template = new saddle.Template([
          new saddle.DynamicText(new FakeExpression('dynamicTemplate'))
        ]);
        var data = {
          dynamicTemplate: new saddle.DynamicText(new FakeExpression('text')),
          text: 'Yo'
        };
        var textBinding = render(template, data).shift();
        expect(getText(fixture)).equal('Yo');
        data.text = 'Hola';
        textBinding.context = getContext(data);
        textBinding.update();
        expect(getText(fixture)).equal('Hola');
      });

      it('updates a CommentNode', function() {
        var template = new saddle.Template([
          new saddle.DynamicComment(new FakeExpression('comment'))
        ]);
        var binding = render(template, {comment: 'Hi'}).pop();
        expect(fixture.innerHTML).equal('<!--Hi-->');
        binding.context = getContext({comment: 'Bye'});
        binding.update();
        expect(fixture.innerHTML).equal('<!--Bye-->');
      });

      it('updates raw HTML', function() {
        var template = new saddle.Template([
          new saddle.DynamicHtml(new FakeExpression('html')),
          new saddle.Element('div')
        ]);
        var binding = render(template, {html: '<b>Hi</b>'}).pop();
        var children = getChildren(fixture);
        expect(children.length).equal(2);
        expect(children[0].tagName.toLowerCase()).equal('b');
        expect(children[0].innerHTML).equal('Hi');
        expect(children[1].tagName.toLowerCase()).equal('div');
        binding.context = getContext({html: '<i>What?</i>'});
        binding.update();
        var children = getChildren(fixture);
        expect(children.length).equal(2);
        expect(children[0].tagName.toLowerCase()).equal('i');
        expect(children[0].innerHTML).equal('What?');
        expect(children[1].tagName.toLowerCase()).equal('div');
        binding.context = getContext({html: 'Hola'});
        binding.update();
        var children = getChildren(fixture);
        expect(children.length).equal(1);
        expect(getText(fixture)).equal('Hola');
        expect(children[0].tagName.toLowerCase()).equal('div');
      });

      it('updates an Element attribute', function() {
        var template = new saddle.Template([
          new saddle.Element('div', {
            'class': new saddle.Attribute('message'),
            'data-greeting': new saddle.DynamicAttribute(new FakeExpression('greeting'))
          })
        ]);
        var binding = render(template).pop();
        var node = fixture.firstChild;
        expect(node.className).equal('message');
        expect(node.getAttribute('data-greeting')).eql(null);
        // Set initial value
        binding.context = getContext({greeting: 'Yo'});
        binding.update();
        expect(node.getAttribute('data-greeting')).equal('Yo');
        // Change value for same attribute
        binding.context = getContext({greeting: 'Hi'});
        binding.update();
        expect(node.getAttribute('data-greeting')).equal('Hi');
        // Clear value
        binding.context = getContext();
        binding.update();
        expect(node.getAttribute('data-greeting')).eql(null);
        // Dynamic updates don't affect static attribute
        expect(node.className).equal('message');
      });

      it('updates text input "value" property', function() {
        var template = new saddle.Template([
          new saddle.Element('input', {
            'value': new saddle.DynamicAttribute(new FakeExpression('text')),
          })
        ]);

        var binding = render(template).pop();
        var input = fixture.firstChild;

        // Set initial value to string.
        binding.context = getContext({text: 'Hi'});
        binding.update();
        expect(input.value).equal('Hi');

        // Update using numeric value, check that title is the stringified number.
        binding.context = getContext({text: 123});
        binding.update();
        expect(input.value).equal('123');

        // Change value to undefined, make sure attribute is removed.
        binding.context = getContext({});
        binding.update();
        expect(input.value).equal('');
      });

      it('does not clobber input type="number" value when typing "1.0"', function() {
        var template = new saddle.Template([
          new saddle.Element('input', {
            'type': new saddle.Attribute('number'),
            'value': new saddle.DynamicAttribute(new FakeExpression('amount')),
          })
        ]);

        var binding = render(template).pop();
        var input = fixture.firstChild;

        // Make sure that a user-typed input value of "1.0" does not get clobbered by
        // a context value of `1`.
        input.value = '1.0';
        binding.context = getContext({amount: 1});
        binding.update();
        expect(input.value).equal('1.0');
      });

      it('updates "title" attribute', function() {
        var template = new saddle.Template([
          new saddle.Element('div', {
            'title': new saddle.DynamicAttribute(new FakeExpression('divTooltip')),
          })
        ]);

        var binding = render(template).pop();
        var node = fixture.firstChild;

        // Set initial value to string.
        binding.context = getContext({divTooltip: 'My tooltip'});
        binding.update();
        expect(node.title).equal('My tooltip');

        // Update using numeric value, check that title is the stringified number.
        binding.context = getContext({divTooltip: 123});
        binding.update();
        expect(node.title).equal('123');

        // Change value to undefined, make sure attribute is removed.
        binding.context = getContext({});
        binding.update();
        expect(node.title).equal('');
      });

      it('updates a Block', function() {
        var template = new saddle.Template([
          new saddle.Block(new FakeExpression('author'), [
            new saddle.Element('h3', null, [
              new saddle.DynamicText(new FakeExpression('name'))
            ]),
            new saddle.DynamicText(new FakeExpression('name'))
          ])
        ]);
        var binding = render(template).pop();
        var children = getChildren(fixture);
        expect(children.length).equal(1);
        expect(children[0].tagName.toLowerCase()).equal('h3');
        expect(getText(children[0])).equal('');
        expect(getText(fixture)).equal('');
        // Update entire block context
        binding.context = getContext({author: {name: 'John'}});
        binding.update();
        var children = getChildren(fixture);
        expect(children.length).equal(1);
        expect(children[0].tagName.toLowerCase()).equal('h3');
        expect(getText(children[0])).equal('John');
        expect(getText(fixture)).equal('JohnJohn');
        // Reset to no data
        binding.context = getContext();
        binding.update();
        var children = getChildren(fixture);
        expect(children.length).equal(1);
        expect(children[0].tagName.toLowerCase()).equal('h3');
        expect(getText(children[0])).equal('');
        expect(getText(fixture)).equal('');
      });

      it('updates a single condition ConditionalBlock', function() {
        var template = new saddle.Template([
          new saddle.ConditionalBlock([
            new FakeExpression('show')
          ], [
            [new saddle.Text('shown')]
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('');
        // Update value
        binding.context = getContext({show: true});
        binding.update();
        expect(getText(fixture)).equal('shown');
        // Reset to no data
        binding.context = getContext({show: false});
        binding.update();
        expect(getText(fixture)).equal('');
      });

      it('updates a multi-condition ConditionalBlock', function() {
        var template = new saddle.Template([
          new saddle.ConditionalBlock([
            new FakeExpression('primary'),
            new FakeExpression('alternate'),
            new FakeElseExpression()
          ], [
            [new saddle.DynamicText(new FakeExpression())],
            [],
            [new saddle.Text('else')]
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('else');
        // Update value
        binding.context = getContext({primary: 'Heyo'});
        binding.update();
        expect(getText(fixture)).equal('Heyo');
        // Update value
        binding.context = getContext({alternate: true});
        binding.update();
        expect(getText(fixture)).equal('');
        // Reset to no data
        binding.context = getContext();
        binding.update();
        expect(getText(fixture)).equal('else');
      });

      it('updates an each of text', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression())
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('');
        // Update value
        binding.context = getContext({items: ['One', 'Two', 'Three']});
        binding.update();
        expect(getText(fixture)).equal('OneTwoThree');
        // Update value
        binding.context = getContext({items: ['Four', 'Five']});
        binding.update();
        expect(getText(fixture)).equal('FourFive');
        // Update value
        binding.context = getContext({items: []});
        binding.update();
        expect(getText(fixture)).equal('');
        // Reset to no data
        binding.context = getContext();
        binding.update();
        expect(getText(fixture)).equal('');
      });

      it('updates an each with an else', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name'))
          ], [
            new saddle.Text('else')
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('else');
        // Update value
        binding.context = getContext({items: [
          {name: 'One'}, {name: 'Two'}, {name: 'Three'}
        ]});
        binding.update();
        expect(getText(fixture)).equal('OneTwoThree');
        // Update value
        binding.context = getContext({items: [
          {name: 'Four'}, {name: 'Five'}
        ]});
        binding.update();
        expect(getText(fixture)).equal('FourFive');
        // Update value
        binding.context = getContext({items: []});
        binding.update();
        expect(getText(fixture)).equal('else');
        // Reset to no data
        binding.context = getContext();
        binding.update();
        expect(getText(fixture)).equal('else');
      });

      it('inserts in an each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name'))
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('');
        // Insert from null state
        var data = {items: []};
        binding.context = getContext(data);
        insert(binding, data.items, 0, [{name: 'One'}, {name: 'Two'}, {name: 'Three'}]);
        expect(getText(fixture)).equal('OneTwoThree');
        // Insert new items
        insert(binding, data.items, 1, [{name: 'Four'}, {name: 'Five'}]);
        expect(getText(fixture)).equal('OneFourFiveTwoThree');
      });

      it('inserts into empty each with else', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name'))
          ], [
            new saddle.Text('else')
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('else');
        // Insert from null state
        var data = {items: []};
        binding.context = getContext(data);
        insert(binding, data.items, 0, [{name: 'One'}, {name: 'Two'}, {name: 'Three'}]);
        expect(getText(fixture)).equal('OneTwoThree');
      });

      it('removes all items in an each with else', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name'))
          ], [
            new saddle.Text('else')
          ])
        ]);
        var data = {items: [
          {name: 'One'}, {name: 'Two'}, {name: 'Three'}
        ]};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('OneTwoThree');
        binding.context = getContext(data);
        // Remove all items
        remove(binding, data.items, 0, 3);
        expect(getText(fixture)).equal('else');
      });

      it('removes in an each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name'))
          ])
        ]);
        var data = {items: [
          {name: 'One'}, {name: 'Two'}, {name: 'Three'}
        ]};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('OneTwoThree');
        binding.context = getContext(data);
        // Remove inner item
        remove(binding, data.items, 1, 1);
        expect(getText(fixture)).equal('OneThree');
        // Remove multiple remaining
        remove(binding, data.items, 0, 2);
        expect(getText(fixture)).equal('');
      });

      it('moves in an each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name'))
          ])
        ]);
        var data = {items: [
          {name: 'One'}, {name: 'Two'}, {name: 'Three'}
        ]};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('OneTwoThree');
        binding.context = getContext(data);
        // Move one item
        move(binding, data.items, 1, 2, 1);
        expect(getText(fixture)).equal('OneThreeTwo');
        // Move multiple items
        move(binding, data.items, 1, 0, 2);
        expect(getText(fixture)).equal('ThreeTwoOne');
      });

      it('insert, move, and remove with multiple node items', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.Element('h3', null, [
              new saddle.DynamicText(new FakeExpression('title'))
            ]),
            new saddle.DynamicText(new FakeExpression('text'))
          ])
        ]);
        var data = {items: [
          {title: '1', text: 'one'},
          {title: '2', text: 'two'},
          {title: '3', text: 'three'}
        ]};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('1one2two3three');
        binding.context = getContext(data);
        // Insert an item
        insert(binding, data.items, 2, [{title: '4', text: 'four'}]);
        expect(getText(fixture)).equal('1one2two4four3three');
        // Move items
        move(binding, data.items, 1, 0, 3);
        expect(getText(fixture)).equal('2two4four3three1one');
        // Remove an item
        remove(binding, data.items, 2, 1);
        expect(getText(fixture)).equal('2two4four1one');
      });

      it('inserts to outer nested each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name')),
            new saddle.EachBlock(new FakeExpression('subitems'), [
              new saddle.DynamicText(new FakeExpression())
            ])
          ])
        ]);
        var binding = render(template).pop();
        expect(getText(fixture)).equal('');
        // Insert from null state
        var data = {items: []};
        binding.context = getContext(data);
        insert(binding, data.items, 0, [
          {name: 'One', subitems: [1, 2, 3]},
          {name: 'Two', subitems: [2, 4, 6]},
          {name: 'Three', subitems: [3, 6, 9]}
        ]);
        expect(getText(fixture)).equal('One123Two246Three369');
        // Insert new items
        insert(binding, data.items, 1, [
          {name: 'Four', subitems: [4, 8, 12]},
          {name: 'Five', subitems: [5, 10, 15]}
        ]);
        expect(getText(fixture)).equal('One123Four4812Five51015Two246Three369');
        // Insert new items again
        insert(binding, data.items, 2, [
          {name: 'Six', subitems: [6, 12, 18]}
        ]);
        expect(getText(fixture)).equal('One123Four4812Six61218Five51015Two246Three369');
      });

      it('removes from outer nested each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name')),
            new saddle.EachBlock(new FakeExpression('subitems'), [
              new saddle.DynamicText(new FakeExpression())
            ])
          ])
        ]);
        var data = {items: [
          {name: 'One', subitems: [1, 2, 3]},
          {name: 'Two', subitems: [2, 4, 6]},
          {name: 'Three', subitems: [3, 6, 9]}
        ]};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('One123Two246Three369');
        binding.context = getContext(data);
        // Remove inner item
        remove(binding, data.items, 1, 1);
        expect(getText(fixture)).equal('One123Three369');
        // Remove multiple remaining
        remove(binding, data.items, 0, 2);
        expect(getText(fixture)).equal('');
      });

      it('moves to outer nested each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.DynamicText(new FakeExpression('name')),
            new saddle.EachBlock(new FakeExpression('subitems'), [
              new saddle.DynamicText(new FakeExpression())
            ])
          ])
        ]);
        var data = {items: [
          {name: 'One', subitems: [1, 2, 3]},
          {name: 'Two', subitems: [2, 4, 6]},
          {name: 'Three', subitems: [3, 6, 9]}
        ]};
        var binding = render(template, data).pop();
        expect(getText(fixture)).equal('One123Two246Three369');
        binding.context = getContext(data);
        // Move one item
        move(binding, data.items, 1, 2, 1);
        expect(getText(fixture)).equal('One123Three369Two246');
        // Move multiple items
        move(binding, data.items, 1, 0, 2);
        expect(getText(fixture)).equal('Three369Two246One123');
      });

      it('updates an if inside an each', function() {
        var template = new saddle.Template([
          new saddle.EachBlock(new FakeExpression('items'), [
            new saddle.ConditionalBlock([
              new FakeExpression('flag'),
              new FakeElseExpression()
            ], [
              [new saddle.Text('A')],
              [new saddle.Text('B')]
            ])
          ])
        ]);
        var data = {items: [0, 1], flag: true};
        var bindings = render(template, data);
        expect(getText(fixture)).equal('AA');

        var eachBinding = bindings[4];
        var if1Binding = bindings[2];
        var if2Binding = bindings[0];

        data.flag = false;
        if1Binding.update();
        if2Binding.update();
        expect(getText(fixture)).equal('BB');

        remove(eachBinding, data.items, 0, 1);
        expect(getText(fixture)).equal('B');
      });
    }
  });
});

function getContext(data, bindings) {
  var contextMeta = new FakeContextMeta();
  contextMeta.addBinding = function(binding) {
    if (bindings) {
      bindings.push(binding);
    }
  };
  return new FakeContext(contextMeta, data);
}

function removeChildren(node) {
  while (node && node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

// IE <=8 return comments for Node.children
function getChildren(node) {
  var nodeChildren = node.children;
  var children = [];
  for (var i = 0, len = nodeChildren.length; i < len; i++) {
    var child = nodeChildren[i];
    if (child.nodeType === 1) children.push(child);
  }
  return children;
}

function getText(node) {
  return node.textContent;
}
// if (!document.createTextNode('x').textContent) {
//   // IE only supports innerText, and it sometimes returns extra whitespace
//   getText = function(node) {
//     return node.innerText.replace(/\s/g, '');
//   };
// }

function insert(binding, array, index, items) {
  array.splice.apply(array, [index, 0].concat(items));
  binding.insert(index, items.length);
}
function remove(binding, array, index, howMany) {
  array.splice(index, howMany);
  binding.remove(index, howMany);
}
function move(binding, array, from, to, howMany) {
  var values = array.splice(from, howMany);
  array.splice.apply(array, [to, 0].concat(values));
  binding.move(from, to, howMany);
}

function FakeExpression(source) {
  this.source = source;
}
FakeExpression.prototype.toString = function() {
  return this.source;
};
FakeExpression.prototype.get = function(context) {
  return ((this.source == null)
    ? context.data
    : context._get(this.source)
  );
};
FakeExpression.prototype.truthy = function(context) {
  return templateTruthy(this.get(context));
};
FakeExpression.prototype.module = 'expressions';
FakeExpression.prototype.type = 'Expression';
// FakeExpression.prototype.serialize = function() {
//   return serializeObject.instance(this, this.source);
// };

function FakeElseExpression() {}
FakeElseExpression.prototype = new FakeExpression();
FakeElseExpression.prototype.truthy = function() {
  return true;
};
FakeElseExpression.prototype.type = 'ElseExpression';

function templateTruthy(value) {
  return (Array.isArray(value)) ? value.length > 0 : !!value;
}

function FakeContext(meta, data, parent) {
  this.meta = meta;
  this.data = data;
  this.parent = parent;
}
FakeContext.prototype = Object.create(FakeExpression.prototype);
FakeContext.prototype.constructor = FakeContext;
FakeContext.prototype.addBinding = function(binding) {
  this.meta.addBinding(binding);
};
FakeContext.prototype.removeBinding = function(binding) {
  this.meta.removeBinding(binding);
};
FakeContext.prototype.removeNode = function(node) {
  this.meta.removeNode(node);
};
FakeContext.prototype.child = function(expression) {
  var data = expression.get(this);
  return new FakeContext(this.meta, data, this);
};
FakeContext.prototype.eachChild = function(expression, index) {
  var data = expression.get(this)[index];
  return new FakeContext(this.meta, data, this);
};
FakeContext.prototype._get = function(property) {
  return (this.data && this.data.hasOwnProperty(property)) ?
    this.data[property] :
    this.parent && this.parent._get(property);
};
FakeContext.prototype.pause = function() {
  this.meta.pauseCount++;
};
FakeContext.prototype.unpause = function() {
  if (--this.meta.pauseCount) return;
  this.flush();
};
FakeContext.prototype.flush = function() {
  var pending = this.meta.pending;
  var len = pending.length;
  if (!len) return;
  this.meta.pending = [];
  for (var i = 0; i < len; i++) {
    pending[i]();
  }
};
FakeContext.prototype.queue = function(cb) {
  this.meta.pending.push(cb);
};

function noop() {}
function FakeContextMeta() {
  this.addBinding = noop;
  this.removeBinding = noop;
  this.removeNode = noop;
  this.pauseCount = 0;
  this.pending = [];
};
