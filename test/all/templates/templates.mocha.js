var expect = require('chai').expect;
var templates = require('../../../dist/templates/templates');

describe('Views', function() {

  it('registers and finds a view', function() {
    var views = new templates.Views();
    views.register('greeting', 'Hi');
    var view = views.find('greeting');
    expect(view.source).equal('Hi');
  });

  it('registers and finds a nested view', function() {
    var views = new templates.Views();
    views.register('greetings:informal', 'Hi');
    var view = views.find('greetings:informal');
    expect(view.source).equal('Hi');
  });

  it('finds a view relatively', function() {
    var views = new templates.Views();
    views.register('greetings:informal', 'Hi');
    var view = views.find('informal', 'greetings');
    expect(view.source).equal('Hi');
  });

  it('does not find a view in a child namespace', function() {
    var views = new templates.Views();
    views.register('greetings:informal', 'Hi');
    var view = views.find('informal');
    expect(view).equal(undefined);
  });

  it('registers and finds an index view', function() {
    var views = new templates.Views();
    views.register('greetings:informal:index', 'Hi');
    var view = views.find('greetings:informal');
    expect(view.source).equal('Hi');
  });

});

describe('Hooks', function() {
  it('derives valid module attribute from base class', function() {
    class TestHook extends templates.MarkupHook {
      constructor() {
        super();
        this.name = 'TestHook';
      }
    }
    var testHook = new TestHook();
    expect(testHook.name).to.equal('TestHook');
    expect(testHook.module).to.equal('templates');
  });
  it('has valid module name', function() {
    var hook = new templates.ComponentOn('foo');
    expect(hook.name).to.equal('foo');
    expect(hook.module).to.equal('templates');
  });
});
