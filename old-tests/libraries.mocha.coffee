{expect} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
derby = require '../lib/derby'
View = require '../lib/View.server'
ui = require './fixtures/components/ui'


describe 'Component libraries', ->
  derby.use ui

  view = null
  beforeEach (done) ->
    view = new View(derby._libraries)
    model = new Model
    view._init model, false, done

  it 'supports void components from libraries', ->
    view.make 'test', 'give me a <ui:box>'
    expect(view.get 'test').to.equal 'give me a <div class=box></div>'

  it 'supports non-void components from libraries', ->
    view.make 'test', 'give me a <ui:button>Click</ui:button>'
    expect(view.get 'test').to.equal 'give me a <button>Click</button>'

  it 'supports rendering full components from libraries', ->
    view.make 'test', 'give me a <ui:dropdown>'
    expect(view.get 'test').to.equal 'give me a <div id=$0 class="">' + 
      '<button id=$1></button><menu></menu></div>'
