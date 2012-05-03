{expect, calls} = require 'racer/test/util'
EventDispatcher = require '../lib/EventDispatcher'

describe 'EventDispatcher', ->

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

  it 'should work without callbacks', ->
    dispatcher = new EventDispatcher
    dispatcher.bind name1, listener1
    dispatcher.trigger name1, value1, options1

  it 'calls onTrigger', calls 2, (done) ->
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        expect(listener).to.eql listener1
        expect(value).to.equal value1
        expect(options).to.equal options1
        done()
    dispatcher.bind name1, listener1
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name1, value1, options1

  it 'calls onTrigger without listener', calls 2, (done) ->
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        expect(listener).to.equal undefined
        expect(value).to.equal value1
        expect(options).to.equal options1
        done()
    dispatcher.bind name1
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name1, value1, options1

  it 'calls onTrigger for multiple listeners', calls 1, (done) ->
    counts = {all: 0}
    beforeExit = ->
      expect(counts[listener2]).to.equal 1
      expect(counts[listener3]).to.equal 3
      expect(counts[listener4]).to.equal 1
      done()

    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        counts[listener] = (counts[listener] || 0) + 1
        expect(value).to.equal value1
        expect(options).to.equal options1
        beforeExit() if ++counts.all == 5

    dispatcher.bind name1, listener2
    dispatcher.bind name1, listener3
    dispatcher.bind name1, listener4
    dispatcher.bind name2, listener3
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name2, value1, options1
    dispatcher.trigger name2, value1, options1

  it 'test EventDispatcher remove listener after failed trigger', calls 1, (done) ->
    dispatcher = new EventDispatcher
      onTrigger: ->
        done()
        return false
    dispatcher.bind name1
    dispatcher.trigger name1
    dispatcher.trigger name1

  it 'test EventDispatcher do not trigger twice after double bind', calls 1, (done) ->
    dispatcher = new EventDispatcher onTrigger: done
    dispatcher.bind name1, listener1
    dispatcher.bind name1, listener1
    dispatcher.trigger name1

  it 'test EventDispatcher bind callback', calls 3, (done) ->
    dispatcher = new EventDispatcher
      onTrigger: (name, listener, value, options) ->
        expect(listener).to.eql listener1
        expect(value).to.equal value1
        expect(options).to.equal options1
        done()
      onBind: (name, listener) ->
        expect(name).to.equal name1
        expect(listener).to.eql listener1
        done()
    dispatcher.bind name1, listener1
    dispatcher.trigger name1, value1, options1
    dispatcher.trigger name1, value1, options1
