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
    # The id of '$0' is used for the component namespace, which is why the
    # first element has an id of '$1'
    expect(view.get 'test').to.equal 'give me a <div id=$1 class="">' + 
      '<button id=$2></button><menu></menu></div>'
