var wrapTest = require('./helpers').wrapTest,
    assert = require('assert'),
    _ = require('../lib/utils'),
    model = require('../lib/model.js');

function makeModel(environment) {
  _.onServer = environment === 'server';
  return model();
}

module.exports = {
  'test model set and get simple objects': function() {
    var model = makeModel('browser'),
        page = {
          name: 'test',
          lines: ['line1', 'line 2', 'more lines...'],
          length: 3
        };
    model.set('files.doc.page', page);
    model.get('files.doc.page').should.eql(page);
    model.get().should.eql({ files: { doc: { page: page } } });
    model.get('files.doc.page.name').should.eql(page.name);
    model.get('files.doc.page.lines').should.eql(page.lines);
    model.get('files.doc.page.lines.1').should.eql('line 2');
    model.set('files.info', { more: 'stuff' });
    model.set('files.doc.page.name', 34);
    page.name = 34;
    model.get().should.eql({
      files: {
        doc: { page: page },
        info: { more: 'stuff' }
      }
    });
  },
  'test model init data': function() {
    var model = makeModel('server'),
        obj = {
          files: {
            doc: {
              num: 3,
              arr: [2, 3, 4]
            }
          }
        };
    model.init(obj);
    model.get().should.eql(obj);
    model.get('files.doc.num').should.eql(3);
  },
  'test model set and get references': function() {
    var model = makeModel('server');
    model.init({
      info: {
        users: [
          // References can be direct links to another object in the model
          { name: 'user1', color: model.ref('info.favoriteColors') },
          { name: 'ben', color: 'purple' }
        ],
        favoriteColors: ['aqua', 'orange']
      },
      userIndex: 1,
      // They can also take a second argument for another model object that
      // acts as a key on the referenced object
      user: model.ref('info.users', 'userIndex')
    });
    // References can be used with getters and setters
    model.get('user.name').should.equal('ben');
    model.set('user.color', 'green');
    model.get('info.users.1.color').should.equal('green');
    // Update the reference key
    model.set('userIndex', 0);
    model.get('user.color.0').should.equal('aqua');
    // It is possible to modify properties on the referenced object. However, if
    // the item that is currently set to a reference is set to something else,
    // the new value replaces the reference and the originally referenced object
    // remains unmodified.
    model.set('user.color.1', 'pink');
    model.set('user.color', 'red');
    model.get('user.color').should.equal('red');
    model.get('info.favoriteColors').should.eql(['aqua', 'pink']);
  },
  'test model trigger successful event on set': wrapTest(function(done) {
    var model = makeModel('browser'),
        domMock = {
          update: function(id, method, property, viewFunc, value) {
            id.should.equal('test');
            method.should.equal('attr');
            property.should.equal('height');
            assert.isNull(viewFunc);
            value.should.equal(11);
            done();
          }
        };
    model._link(domMock);
    model.init({ picHeight: 14 });
    model.events.bind('picHeight', ['test', 'attr', 'height']);
    model.set('picHeight', 11);
    model.set('picHeight', 11);
  }, 2),
  'test model trigger unsuccessful event on set': wrapTest(function(done) {
    var model = makeModel('browser'),
        domMock = {
          update: function() {
            done();
            return false;
          }
        };
    model._link(domMock);
    model.init({ picHeight: 14 });
    model.events.bind('picHeight', ['test', 'attr', 'height']);
    model.set('picHeight', 11);
    model.set('picHeight', 11);
  }, 1),
  'test model trigger event on reference set': wrapTest(function(done) {
    var model = makeModel('browser'),
        expectedColor,
        domMock = {
          update: function(id, method, property, viewFunc, value) {
            id.should.equal('test');
            method.should.equal('prop');
            property.should.eql(['style', 'color']);
            assert.isNull(viewFunc);
            value.should.equal(expectedColor);
            done();
          }
        };
    model._link(domMock);
    model.init({
      info: {
        users: [
          { name: 'user1', colors: model.ref('info.favoriteColors') },
          { name: 'ben', colors: ['black', 'white'] }
        ],
        favoriteColors: ['aqua', 'orange']
      },
      userIndex: 0,
      user: model.ref('info.users', 'userIndex')
    });
    model.events.bind('user.colors.1', ['test', 'prop', ['style', 'color']]);
    // Trigger when a value is set on the reference
    expectedColor = 'violet';
    model.set('user.colors.1', expectedColor);
    expectedColor = 'gold';
    model.set('info.users.0.colors.1', expectedColor);
    expectedColor = 'silver';
    model.set('info.favoriteColors.1', expectedColor);
    // Trigger when a reference key is changed
    expectedColor = 'white';
    model.set('userIndex', 1);
    // Trigger when the referenced object is set
    expectedColor = 'teal'
    model.set('info.users.1.colors.1', expectedColor);
    // This should start to trigger and fail, since it is an out of date reference
    model.events.get().should.have.property('info.favoriteColors.1');
    model.set('info.users.0.colors.1', 'black');
    model.events.get().should.not.have.property('info.favoriteColors.1');
    // 5 out of these 6 set operations should trigger the callback
  }, 5),
  'test model set and get model functions': function() {
    var model = makeModel('server');
    model.init({
      item: {
        val: model.func('add'),
        arg1: 11
      },
      arg2: 7
    });
    model.makeFunc('add', ['item.arg1', 'arg2'], function(arg1, arg2) {
      return arg1 + arg2;
    });
    model.get('item.val').should.equal(18);
    model.set('item.arg1', 21);
    model.get('item.val').should.equal(28);
    model.set('arg2', 0);
    model.get('item.val').should.equal(21);
  },
  'test model function composition and events': wrapTest(function(done) {
    var model = makeModel('browser'),
        expectedValue;
        domMock = {
          update: function(id, method, property, viewFunc, value) {
            value.should.equal(expectedValue);
            done();
          }
        };
    model._link(domMock);
    model.init({
      in: { a: 3, b: 5, c: model.ref('numbers.0') },
      funcs: {
        sum: model.func('sum'),
        text: model.func('cat')
      },
      message: 'double sum is: ',
      numbers: [0, 2, 3],
      func: 'text',
      out: model.ref('funcs', 'func')
    });
    model.makeFunc('sum', ['in.a', 'in.b', 'in.c'], function(a, b, c) {
      return a + b + c;
    });
    model.makeFunc('cat', ['message', 'funcs.sum'], function(message, num) {
      return message + (num * 2);
    });
    model.events.bind('funcs.sum', []);
    model.get('funcs.sum').should.equal(8);
    model.get('funcs.text').should.equal('double sum is: 16');
    
    // Test setting on an input updates the function listener
    expectedValue = 3;
    model.set('in.b', 0);
    model.get('funcs.sum').should.equal(expectedValue);
    model.get('funcs.text').should.equal('double sum is: 6');
    
    // Check for propogation of a reference to event triggering
    expectedValue = 4;
    model.set('numbers.0', 1);
    model.get('funcs.sum').should.equal(expectedValue);
    
    // Shouldn't trigger after removal of event listener
    model.events.unbind('funcs.sum', []);
    model.set('in.b', -2);
    
    // Add a listener to a function of a function
    model.events.bind('funcs.text', []);
    expectedValue = 'double sum is: -2';
    model.set('in.a', 0);
    model.get('funcs.text', expectedValue);
    model.get('funcs.sum', -2);
    model.events.unbind('funcs.text', []);
    
    // Add a listener to a reference to a function
    model.events.bind('out', []);
    model.set('in.a', 0);
  }, 4),
  'test model push': wrapTest(function(done) {
    var model = makeModel('browser'),
        domMock = {
          update: function(id, method, property, viewFunc, value) {
            id.should.equal('list');
            method.should.equal('appendHtml');
            assert.isNull(property);
            viewFunc.should.equal('stuff');
            value.should.equal('hey');
            done();
          }
        };
    model._link(domMock);
    model.init({
      stuff: {
        items: ['item1', [8, 3, 'q'], 'item3']
      }
    });
    model.events.bind('stuff.items', ['list', 'html', null, 'stuff']);
    model.push('stuff.items', 'hey');
    model.get('stuff.items').should.eql(['item1', [8, 3, 'q'], 'item3', 'hey']);
  }, 1),
  'test model server sends update messages': wrapTest(function(done) {
    var model = makeModel('server');
  }, 0),
  'test model browser sends update messages': wrapTest(function(done) {
    var model = makeModel('browser');
  }, 0),
  'test model server and browser models sync': wrapTest(function(done) {
    var serverModel = makeModel('server'),
        browserModel = makeModel('browser');
  }, 0),
}