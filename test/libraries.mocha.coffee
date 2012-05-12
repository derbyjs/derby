{expect} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
derby = require '../lib/derby'
View = require '../lib/View.server'
ui = require './fixtures/components/ui'


describe 'Component libraries', ->
  derby.use ui

  it 'supports void components from libraries', ->
    view = new View(derby._libraries)
    view._init new Model

    view.make 'test', 'give me a <ui:box>'
    expect(view.get 'test').to.equal 'give me a <div class=box></div>'

  it 'supports non-void components from libraries', ->
    view = new View(derby._libraries)
    view._init new Model

    view.make 'test', 'give me a <ui:button>Click</ui:button>'
    expect(view.get 'test').to.equal 'give me a <button>Click</button>'
