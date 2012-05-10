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

    console.log(view._libraries.__proto__)

    # view.make 'test', 'give me a <ui:box>'
    # expect(view.get 'test').to.equal 'give me a <div class=box></div>'
