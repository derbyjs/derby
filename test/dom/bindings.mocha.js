var expect = require('chai').expect;
var domTestRunner = require('../../src/test-utils/domTestRunner');

describe('bindings', function() {
  var runner = domTestRunner.install();

  describe('bracket dependencies', function() {
    it('bracket inner dependency change', function() {
      var app = runner.createHarness().app;
      app.views.register('Body', '{{_page.doc[_page.key]}}');
      var page = app.createPage();
      var doc = page.model.at('_page.doc');
      var key = page.model.at('_page.key');
      doc.set({
        one: 'hi',
        two: 'bye'
      });
      key.set('one');
      var fragment = page.getFragment('Body');
      expect(fragment).html('hi');
      key.set('two');
      expect(fragment).html('bye');
      key.del();
      expect(fragment).html('');
      key.set('one');
      expect(fragment).html('hi');
    });

    it('bracket outer dependency change', function() {
      var app = runner.createHarness().app;
      app.views.register('Body', '{{_page.doc[_page.key]}}');
      var page = app.createPage();
      var doc = page.model.at('_page.doc');
      var key = page.model.at('_page.key');
      doc.set({
        one: 'hi',
        two: 'bye'
      });
      key.set('one');
      var fragment = page.getFragment('Body');
      expect(fragment).html('hi');
      doc.set('one', 'hello')
      expect(fragment).html('hello');
      doc.set({
        one: 'heyo'
      });
      expect(fragment).html('heyo');
      doc.del();
      expect(fragment).html('');
    });

    it('bracket inner then outer dependency change', function() {
      var app = runner.createHarness().app;
      app.views.register('Body', '{{_page.doc[_page.key]}}');
      var page = app.createPage();
      var doc = page.model.at('_page.doc');
      var key = page.model.at('_page.key');
      doc.set({
        one: 'hi',
        two: 'bye'
      });
      key.set('one');
      var fragment = page.getFragment('Body');
      expect(fragment).html('hi');
      key.set('two');
      expect(fragment).html('bye');
      doc.set({
        one: 'heyo',
        two: 'later'
      });
      expect(fragment).html('later');
      doc.set('two', 'adios');
      expect(fragment).html('adios');
      key.set('one');
      expect(fragment).html('heyo');
    });
  });

  describe('dynamic view instances', function() {
    it('simple dynamic view', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<view is="{{_page.view}}" optional></view>'
      );
      app.views.register('one', 'One');
      app.views.register('two', 'Two');
      var page = app.createPage();
      var view = page.model.at('_page.view');
      view.set('one');
      var fragment = page.getFragment('Body');
      expect(fragment).html('One');
      view.set('two');
      expect(fragment).html('Two');
      view.del();
      expect(fragment).html('');
      view.set('one');
      expect(fragment).html('One');
    });
    it('bracketed dynamic view', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<view is="{{_page.names[_page.index]}}" optional></view>'
      );
      app.views.register('one', 'One');
      app.views.register('two', 'Two');
      app.views.register('three', 'Three');
      var page = app.createPage();
      page.model.set('_page.names', ['one', 'two']);
      var index = page.model.at('_page.index');
      index.set(0);
      var fragment = page.getFragment('Body');
      expect(fragment).html('One');
      index.set(1);
      expect(fragment).html('Two');
      index.del();
      expect(fragment).html('');
      index.set(0);
      expect(fragment).html('One');
      page.model.set('_page.names', ['two', 'one']);
      expect(fragment).html('Two');
      page.model.unshift('_page.names', 'three');
      expect(fragment).html('Three');
    });
    it('only renders if the expression value changes', function() {
      var app = runner.createHarness().app;
      var count = 0;
      app.proto.count = function() {
        return count++;
      };
      app.proto.lower = function(value) {
        return value.toLowerCase();
      };
      app.views.register('Body', '<view is="{{lower(_page.view)}}"></view>');
      app.views.register('one', 'One {{count()}}');
      app.views.register('two', 'Two {{count()}}');
      var page = app.createPage();
      var view = page.model.at('_page.view');
      view.set('one');
      var fragment = page.getFragment('Body');
      expect(fragment).html('One 0');
      view.set('two');
      expect(fragment).html('Two 1');
      view.set('TWO');
      expect(fragment).html('Two 1');
      view.set('ONE');
      expect(fragment).html('One 2');
      view.set('one');
      expect(fragment).html('One 2');
    });
  });

  describe('basic blocks', function() {
    it('if', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '{{if _page.nested.value}}' +
          '{{this}}.' +
        '{{else}}' +
          'otherwise' +
        '{{/if}}'
      );
      var page = app.createPage();
      var fragment = page.getFragment('Body');
      expect(fragment).html('otherwise');
      var value = page.model.at('_page.nested.value');
      value.set(true);
      expect(fragment).html('true.');
      value.set(false);
      expect(fragment).html('otherwise');
      value.set('hello');
      expect(fragment).html('hello.');
    });
    it('unless', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '{{unless _page.nested.value}}' +
          'nada' +
        '{{else}}' +
          'otherwise' +
        '{{/unless}}'
      );
      var page = app.createPage();
      var fragment = page.getFragment('Body');
      expect(fragment).html('nada');
      var value = page.model.at('_page.nested.value');
      value.set(true);
      expect(fragment).html('otherwise');
      value.set(false);
      expect(fragment).html('nada');
      value.set('hello');
      expect(fragment).html('otherwise');
    });
    it('each else', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '{{each _page.items}}' +
          '{{this}}.' +
        '{{else}}' +
          'otherwise' +
        '{{/each}}'
      );
      var page = app.createPage();
      var fragment = page.getFragment('Body');
      expect(fragment).html('otherwise');
      var items = page.model.at('_page.items');
      items.set(['one', 'two', 'three']);
      expect(fragment).html('one.two.three.');
      items.set([]);
      expect(fragment).html('otherwise');
      items.insert(0, ['one', 'two', 'three']);
      expect(fragment).html('one.two.three.');
      items.remove(0, 2);
      expect(fragment).html('three.');
      items.remove(0, 1);
      expect(fragment).html('otherwise');
    });
  });

  describe('nested blocks', function() {
    it('each containing if', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '{{each _page.items as #item}}' +
          '{{if _page.toggle}}' +
            '{{#item}}.' +
          '{{/if}}' +
        '{{/each}}'
      );
      var page = app.createPage();
      var items = page.model.at('_page.items');
      var toggle = page.model.at('_page.toggle');
      var fragment = page.getFragment('Body');
      items.set(['one', 'two', 'three']);
      toggle.set(true);
      items.move(2, 1);
      expect(fragment).html('one.three.two.');
    });
  });

  describe('as properties', function() {
    it('conditionally rendered', function(done) {
      var harness = runner.createHarness(`
      <view is="box" as="box"/>
    `);
      function Box() {}
      Box.view = {
        is: 'box',
        source:`
          <index:>
          {{if _page.foo}}
            <div as="myDiv">one</div>
          {{else}}
            <div as="myDiv">two</div>
          {{/if}}>
        `
      };
      var app = harness.app;
      app.component(Box);
      var page = harness.renderDom();
      var value = page.component.model.at('_page.foo');
      value.set(true);
      var initialElement = page.box.myDiv;
      expect(page.box.myDiv, 'check pre value change')
        .instanceOf(Object)
        .to.have.property('textContent', 'one');
      value.set(false);
      process.nextTick(() => {
        expect(page.box.myDiv, 'check post value change')
          .instanceOf(Object)
          .to.have.property('textContent', 'two');
        expect(page.box.myDiv).to.not.equal(initialElement);
        done();
      });
    });

    ['__proto__', 'constructor'].forEach(function(badKey) {
      it(`disallows prototype modification with ${badKey}`, function() {
        var harness = runner.createHarness(`
          <view is="box"/>
        `);
        function Box() {}
        Box.view = {
          is: 'box',
          source:`
            <index:>
              <div as="${badKey}">one</div>
          `
        };
        var app = harness.app;
        app.component(Box);
        expect(() => harness.renderDom()).to.throw(`Unsafe key "${badKey}"`);
        // Rendering to HTML string should still work, as that doesn't process `as` attributes
        expect(harness.renderHtml().html).to.equal('<div>one</div>');
      });
    });
  });

  function testArray(itemTemplate, itemData) {
    it('each on path', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' + itemTemplate + '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    it('each on alias', function() {
      var app = runner.createHarness().app;
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
      var app = runner.createHarness().app;
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
      var app = runner.createHarness().app;
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
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<view is="list" items="{{_page.items}}"></view>'
      );
      app.views.register('list',
        '<ul>' +
          '{{each @items as #item, #i}}' + itemTemplate + '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    it('each containing withs', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' +
            '{{with this}}' +
              '{{with this}}' +
                '{{with this}}' +
                  itemTemplate +
                '{{/with}}' +
              '{{/with}}' +
            '{{/with}}' +
          '{{/each}}' +
        '</ul>'
      );
      testEach(app);
    });
    it('each containing view instance', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' +
            '<view is="item"></view>' +
          '{{/each}}' +
        '</ul>'
      );
      app.views.register('item', itemTemplate);
      testEach(app);
    });
    it('each containing view instance containing with', function() {
      var app = runner.createHarness().app;
      app.views.register('Body',
        '<ul>' +
          '{{each _page.items as #item, #i}}' +
            '<view is="item"></view>' +
          '{{/each}}' +
        '</ul>'
      );
      app.views.register('item', '{{with this}}' + itemTemplate + '{{/with}}');
      testEach(app);
    });
    function testEach(app) {
      var page = app.createPage();
      var items = page.model.at('_page.items');
      var fragment = page.getFragment('Body');
      expect(fragment).html('<ul></ul>');
      items.insert(0, itemData.slice(0, 2));
      expect(fragment).html(
        '<ul><li>0. One One</li><li>1. Two Two</li></ul>'
      );
      items.push(itemData[2]);
      expect(fragment).html(
        '<ul><li>0. One One</li><li>1. Two Two</li><li>2. Three Three</li></ul>'
      );
      items.unshift(itemData[3]);
      expect(fragment).html(
        '<ul><li>0. Four Four</li><li>1. One One</li><li>2. Two Two</li><li>3. Three Three</li></ul>'
      );
      items.remove(1, 2);
      expect(fragment).html(
        '<ul><li>0. Four Four</li><li>1. Three Three</li></ul>'
      );
      items.shift();
      expect(fragment).html(
        '<ul><li>0. Three Three</li></ul>'
      );
      items.pop();
      expect(fragment).html(
        '<ul></ul>'
      );
      items.pop();
      expect(fragment).html(
        '<ul></ul>'
      );
      items.push(itemData[0]);
      expect(fragment).html(
        '<ul><li>0. One One</li></ul>'
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

  it('array item binding with view function calls', function() {
    var app = runner.createHarness().app;
    app.views.register('Body', '<view is="box" list="{{_page.list}}"/ boxName="My box"/>');
    function Box() {}
    Box.view = {
      is: 'box',
      source:
        '<index:>' +
        '{{each list.items as #item, #i}}' +
          '<view is="item-row" item="{{#item}}" index="{{#i}}"/>' +
        '{{/each}}'
    };
    app.component(Box);
    // The second argument to `len(@item, boxName)` is important to the test, even though it's
    // unused by the function implementation. The presence of the second argument adds an additional
    // dependency in the function binding, subtly changing how `binding.eventModels` gets set up.
    app.views.register('item-row', '<div>{{@item}} <view is="item-len" len="{{len(@item, boxName)}}"/></div>');
    app.views.register('item-len', '[L={{@len}}]');
    app.proto.len = function(str) {
      if (str == null) {
        throw new Error('len(str) function param is null');
      }
      return str.length;
    };
    var page = app.createPage();
    var $items = page.model.at('_page.list.items');
    $items.set(['alpha', 'beta']);
    // if getFragment called before second set() call, bindings are evaluated
    // multiple times, leading to suggested bug below of len() called w undefined
    const fragment = page.getFragment('Body');
    expect(fragment).html('<div>alpha [L=5]</div><div>beta [L=4]</div>');
    // When `items` gets set to an array of one, down from two, a possible bug is the `len` function
    // getting invoked again for the no-longer-existing second item, resulting in a thrown exception.
    $items.set(['omega']);
    expect(fragment).html('<div>omega [L=5]</div>');
  });

  // Racer model listeners could mutate the model, causing changed mutations.
  // These events queue up in the model's mutator event queue. Derby knows
  // when to re-evaluate bindings by registering catch-all model listeners.

  // If a first event triggers a listener that causes a mutation on the same
  // path, and if Derby's listeners were to participate in the event queue,
  // then the model would get mutated before Derby can update bindings
  // in response to the first event. That would mean incorrect UI updates.

  // For example, say an array starts with [A]. First, we insert B at index 0,
  // then inside a listener on the array, we insert C at index 0. The final
  // state of the array is [C, B, A]. However, if the model gets mutated to
  // the final state before Derby can update its bindings in response to the
  // first insert, then the UI would end up showing [C, C, A].

  // This is solved by having Derby register its catch-all listeners using
  // the *Immediate events, which operate outside the mutator event queue.
  it('array chained insertions at index 0', function() {
    var app = runner.createHarness().app;
    app.views.register('Body',
      '<ul>' +
        '{{each _data.items as #item}}' +
          '<li>{{#item}}</li>' +
        '{{/each}}' +
      '</ul>'
    );

    var page = app.createPage();
    page.model.on('insert', '_data.items', function(index, values) {
      if (values[0] === 'B') {
        page.model.insert('_data.items', 0, 'C');
      }
    });
    var $items = page.model.at('_data.items');
    $items.set(['A']);

    var fragment = page.getFragment('Body');
    expect(fragment).html('<ul><li>A</li></ul>');
    $items.insert(0, 'B');
    expect(fragment).html('<ul><li>C</li><li>B</li><li>A</li></ul>');
  });

  it('mutation with number path segments', function() {
    // The Page sets up model listeners that call into event model listeners,
    // which handle binding updates. The event model expects that any numeric
    // path segments it receives have been cast into JS numbers, which the
    // Racer model doesn't necessarily guarantee.
    var app = runner.createHarness().app;
    app.views.register('Body',
      '<ul>' +
        '{{each _data.items as #item}}' +
          '<li>{{#item.label}}</li>' +
        '{{/each}}' +
      '</ul>'
    );
    var page = app.createPage();
    var $items = page.model.at('_data.items');
    $items.set([
      {label: 'Red', hexCode: '#ff0000'},
      {label: 'Green', hexCode: '#00ff00'},
      {label: 'Blue', hexCode: '#0000ff'},
    ]);

    var fragment = page.getFragment('Body');
    expect(fragment).html('<ul><li>Red</li><li>Green</li><li>Blue</li></ul>');
    // Test mutation with a numeric path segment.
    page.model.set('_data.items.1.label', 'Verde');
    expect(fragment).html('<ul><li>Red</li><li>Verde</li><li>Blue</li></ul>');
  });
});
