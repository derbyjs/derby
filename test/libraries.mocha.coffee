EventEmitter = require('events').EventEmitter
{expect} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
derby = require '../lib/derby'
View = require '../lib/View.server'
ui = require './fixtures/components/ui'


describe 'Component libraries', ->
  derby.use ui

  view = null
  beforeEach () ->
    view = new View(derby._libraries)
    model = new Model
    view._init model, false
    view.app = new EventEmitter;
    view.renderMock = (name, cb) ->
      view._load true, () ->
        cb view.get name

  it 'supports void components from libraries', (done) ->
    view.make 'test', 'give me a <ui:box>'
    view.renderMock 'test', (html) ->
      expect(html).to.equal 'give me a <div class=box></div>'
      done()

  it 'supports non-void components from libraries', (done) ->
    view.make 'test', 'give me a <ui:button>Click</ui:button>'
    view.renderMock 'test', (html) ->
      expect(html).to.equal 'give me a <button>Click</button>'
      done()

  it 'supports rendering full components from libraries', (done) ->
    view.make 'test', 'give me a <ui:dropdown>'
    view.renderMock 'test', (html) ->
      expect(html).to.equal 'give me a <div id=$0 class="">' + 
      '<button id=$1></button><menu></menu></div>'
      done()
