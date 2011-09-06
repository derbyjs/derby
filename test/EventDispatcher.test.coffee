{wrapTest} = require './util'
should = require 'should'
EventDispatcher = require 'EventDispatcher'

# Names must be a valid object key
name1 = 'test event'
name2 = 89

# Listeners can be anything that is representable in plain JSON 
listener1 = [1, 2, 'qu"a"il', "'", {arr: ['x', 'y']}]
listener2 = 0
listener3 = 'stuff'
listener4 = true

# The second and third parameters sent to trigger are simply passed through
# to the callback function. They can be anything.
value1 = 'test value'
options1 = {option: 4}

module.exports =
  'test EventDispatcher no callbacks': ->
    dispatcher = new EventDispatcher
    dispatcher.bind name1, listener1
    dispatcher.trigger name1, value1, options1

  'test EventDispatcher successful trigger in browser': wrapTest (done) ->
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        listener.should.eql listener1
        value.should.equal value1
        options.should.equal options1
        done()
    dispatcher.bind name1, listener1
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name1, value1, options1
  , 2

  'test EventDispatcher no listener': wrapTest (done) ->
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        should.equal null, listener
        value.should.equal value1
        options.should.equal options1
        done()
    dispatcher.bind name1
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name1, value1, options1
  , 2

  'test EventDispatcher trigger multiple listeners': (beforeExit) ->
    counts = {}
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        counts[listener] = (counts[listener] || 0) + 1
        value.should.equal value1
        options.should.equal options1
    dispatcher.bind name1, listener2
    dispatcher.bind name1, listener3
    dispatcher.bind name1, listener4
    dispatcher.bind name2, listener3
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name2, value1, options1
    dispatcher.trigger name2, value1, options1
    beforeExit = ->
      counts[listener2].should.equal 1
      counts[listener3].should.equal 3
      counts[listener4].should.equal 1

  'test EventDispatcher remove listener after failed trigger': wrapTest (done) ->
    dispatcher = new EventDispatcher
      onTrigger: ->
        done()
        return false
    dispatcher.bind name1
    dispatcher.trigger name1
    dispatcher.trigger name1
  , 1

  'test EventDispatcher do not trigger twice after double bind': wrapTest (done) ->
    dispatcher = new EventDispatcher onTrigger: done
    dispatcher.bind name1, listener1
    dispatcher.bind name1, listener1
    dispatcher.trigger name1
  , 1

  'test EventDispatcher unbind': wrapTest (done) ->
    dispatcher = new EventDispatcher onTrigger: done
    dispatcher.bind name1, listener1
    dispatcher.trigger name1
    dispatcher.trigger name1
    dispatcher.unbind name1, 'some stuff' # Shouldn't do anything
    dispatcher.get().should.have.property name1
    dispatcher.unbind name1, listener1
    dispatcher.get().should.not.have.property name1
    dispatcher.trigger name1
    dispatcher.unbind 'does not exist', null # Shouldn't do anything
  , 2

  'test EventDispatcher get and set': wrapTest (done) ->
    onTrigger = (name, listener, value, options) ->
      listener.should.eql listener1
      value.should.equal value1
      options.should.equal options1
      done()
    dispatcher1 = new EventDispatcher {onTrigger}
    dispatcher2 = new EventDispatcher {onTrigger}
    
    dispatcher1.bind name1, listener1
    data1 = dispatcher1.get()
    
    # Make sure the object returned by get() can be turned into JSON and then
    # back into an equivalent object
    data2 = JSON.parse JSON.stringify data1
    data1.should.eql data2
    data1.should.not.equal data2
    
    dispatcher2.set data2
    dispatcher2.trigger name1, value1, options1
  , 1

  'test EventDispatcher bind callback': wrapTest (done) ->
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        listener.should.eql listener1
        value.should.equal value1
        options.should.equal options1
        done()
      onBind: (name, listener) ->
        name.should.equal name1
        listener.should.eql listener1
        done()
    dispatcher.bind name1, listener1
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name1, value1, options1
  , 3

  'test EventDispatcher bind callback can cancel': wrapTest (done) ->
    dispatcher = new EventDispatcher
      onTrigger: done
      onBind: ->
        done()
        return false
    dispatcher.bind name1
    dispatcher.trigger name1
  , 1
