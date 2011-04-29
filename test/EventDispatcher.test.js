var wrapTest = require('./helpers').wrapTest,
    assert = require('assert'),
    EventDispatcher = require('../lib/EventDispatcher.js');

// Names must be a string
var name1 = 'test event';

// Listeners can be anything that is representable in plain JSON 
var listener1 = [1, 2, 'qu"a"il', "'", { arr: ['x', 'y'] }];

// The second and third parameters sent to trigger are simply passed through
// to the callback function. They can be anything.
var value1 = 'test value';
var options1 = { option: 4 };

module.exports = {
  'test EventDispatcher no callbacks': function() {
    var dispatcher = new EventDispatcher();
    dispatcher._onServer = false;
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1, value1, options1);
  },
  'test EventDispatcher successful trigger in browser': wrapTest(function(done) {
    var triggerFunction = function(listener, value, options) {
          listener.should.eql(listener1);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
          return true;
        },
        dispatcher = new EventDispatcher(triggerFunction);
    dispatcher._onServer = false;
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1, value1, options1);
    dispatcher.trigger(name1, value1, options1);
  }, 2),
  'test EventDispatcher no listener': wrapTest(function(done) {
    var triggerFunction = function(listener, value, options) {
          assert.isNull(listener);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
          return true;
        },
        dispatcher = new EventDispatcher(triggerFunction);
    dispatcher._onServer = false;
    dispatcher.bind(name1);
    dispatcher.trigger(name1, value1, options1);
    dispatcher.trigger(name1, value1, options1);
  }, 2),
  'test EventDispatcher remove listener after failed trigger': wrapTest(function(done) {
    var triggerFunction = function() {
          done();
          return false;
        },
        dispatcher = new EventDispatcher(triggerFunction);
    dispatcher._onServer = false;
    dispatcher.bind(name1);
    dispatcher.trigger(name1);
    dispatcher.trigger(name1);
  }, 1),
  'test EventDispatcher do not trigger on server': wrapTest(function(done) {
    var triggerFunction = done,
        dispatcher = new EventDispatcher(triggerFunction);
    dispatcher._onServer = true;
    dispatcher.bind(name1);
    dispatcher.trigger(name1);
  }, 0),
  'test EventDispatcher do not trigger twice after double bind': wrapTest(function(done) {
    var triggerFunction = done,
        dispatcher = new EventDispatcher(triggerFunction);
    dispatcher._onServer = false;
    dispatcher.bind(name1, listener1);
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1);
  }, 1),
  'test EventDispatcher unbind': wrapTest(function(done) {
    var triggerFunction = function() {
          done();
          return true;
        },
        dispatcher = new EventDispatcher(triggerFunction);
    dispatcher._onServer = false;
    dispatcher.bind(name1, listener1);
    dispatcher.trigger(name1);
    dispatcher.trigger(name1);
    dispatcher.unbind(name1, listener1);
    dispatcher.trigger(name1);
  }, 2),
  'test EventDispatcher get and set': wrapTest(function(done) {
    var triggerFunction = function(listener, value, options) {
          listener.should.eql(listener1);
          value.should.equal(value1);
          options.should.equal(options1);
          done();
          return true;
        },
        dispatcher1 = new EventDispatcher(triggerFunction),
        dispatcher2 = new EventDispatcher(triggerFunction),
        data1, data2;
    dispatcher1._onServer = true;
    dispatcher2._onServer = false;
    
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
}