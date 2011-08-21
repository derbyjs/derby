var wrapTest = require('./helpers').wrapTest,
    assert = require('assert'),
    EventDispatcher = require('../lib/EventDispatcher.js');

// Names must be a valid object key
var name1 = 'test event';
var name2 = 89;

// Listeners can be anything that is representable in plain JSON 
var listener1 = [1, 2, 'qu"a"il', "'", { arr: ['x', 'y'] }];
var listener2 = 0;
var listener3 = 'stuff';
var listener4 = true;

// The second and third parameters sent to trigger are simply passed through
// to the callback function. They can be anything.
var value1 = 'test value';
var options1 = { option: 4 };

function makeDispatcher(environment, onTrigger, onBind) {
  _.onServer = environment === 'server';
  return new EventDispatcher(onTrigger, onBind);
}

module.exports = {
  'test EventDispatcher no callbacks': function() {
    var dispatcher = makeDispatcher('browser');
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1, value1, options1);
  },
  'test EventDispatcher successful trigger in browser': wrapTest(function(done) {
    var onTrigger = function(name, listener, value, options) {
          listener.should.eql(listener1);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
        },
        dispatcher = makeDispatcher('browser', onTrigger);
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1, value1, options1);
    dispatcher.trigger(name1, value1, options1);
  }, 2),
  'test EventDispatcher no listener': wrapTest(function(done) {
    var onTrigger = function(name, listener, value, options) {
          assert.isNull(listener);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
        },
        dispatcher = makeDispatcher('browser', onTrigger);
    dispatcher.bind(name1);
    dispatcher.trigger(name1, value1, options1);
    dispatcher.trigger(name1, value1, options1);
  }, 2),
  'test EventDispatcher trigger multiple listeners': function(beforeExit) {
    var counts = {},
        onTrigger = function(name, listener, value, options) {
          counts[listener] = (counts[listener] || 0) + 1;
          value.should.equal(value1);
          options.should.equal(options1);
        },
        dispatcher = makeDispatcher('browser', onTrigger);
    dispatcher.bind(name1, listener2);
    dispatcher.bind(name1, listener3);
    dispatcher.bind(name1, listener4);
    dispatcher.bind(name2, listener3);
    dispatcher.trigger(name1, value1, options1);
    dispatcher.trigger(name2, value1, options1);
    dispatcher.trigger(name2, value1, options1);
    beforeExit(function() {
      counts[listener2].should.equal(1);
      counts[listener3].should.equal(3);
      counts[listener4].should.equal(1);
    });
  },
  'test EventDispatcher remove listener after failed trigger': wrapTest(function(done) {
    var onTrigger = function() {
          done();
          return false;
        },
        dispatcher = makeDispatcher('browser', onTrigger);
    dispatcher.bind(name1);
    dispatcher.trigger(name1);
    dispatcher.trigger(name1);
  }, 1),
  'test EventDispatcher do not trigger on server': wrapTest(function(done) {
    var onTrigger = done,
        dispatcher = makeDispatcher('server', onTrigger);
    dispatcher.bind(name1);
    dispatcher.trigger(name1);
  }, 0),
  'test EventDispatcher do not trigger twice after double bind': wrapTest(function(done) {
    var onTrigger = done,
        dispatcher = makeDispatcher('browser', onTrigger);
    dispatcher.bind(name1, listener1);
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1);
  }, 1),
  'test EventDispatcher unbind': wrapTest(function(done) {
    var onTrigger = done,
        dispatcher = makeDispatcher('browser', onTrigger);
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1);
    dispatcher.trigger(name1);
    dispatcher.unbind(name1, 'some stuff'); // Shouldn't do anything
    dispatcher.get().should.have.property(name1);
    dispatcher.unbind(name1, listener1);
    dispatcher.get().should.not.have.property(name1);
    dispatcher.trigger(name1);
    dispatcher.unbind('does not exist', null); // Shouldn't do anything
  }, 2),
  'test EventDispatcher get and set': wrapTest(function(done) {
    var onTrigger = function(name, listener, value, options) {
          listener.should.eql(listener1);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
        },
        dispatcher1 = makeDispatcher('server', onTrigger),
        dispatcher2 = makeDispatcher('browser', onTrigger),
        data1, data2;
    
    dispatcher1.bind(name1, listener1);
    data1 = dispatcher1.get();
    
    // Make sure the object returned by get() can be turned into JSON and then
    // back into an equivalent object
    data2 = JSON.parse(JSON.stringify(data1));
    data1.should.eql(data2);
    data1.should.not.equal(data2);
    
    dispatcher2.set(data2);
    dispatcher2.trigger(name1, value1, options1);
  }, 1),
  'test EventDispatcher bind callback': wrapTest(function(done) {
    var onTrigger = function(name, listener, value, options) {
          listener.should.eql(listener1);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
        },
        onBind = function(name, listener) {
          name.should.equal(name1);
          listener.should.eql(listener1);
          done();
        },
        dispatcher = makeDispatcher('browser', onTrigger, onBind);
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1, value1, options1);
    dispatcher.trigger(name1, value1, options1);
  }, 3),
  'test EventDispatcher bind callback can cancel': wrapTest(function(done) {
    var onTrigger = done,
        onBind = function() {
          done();
          return false;
        },
        dispatcher = makeDispatcher('browser', onTrigger, onBind);
    dispatcher.bind(name1);
    dispatcher.trigger(name1);
  }, 1),
}