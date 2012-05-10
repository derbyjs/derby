{expect} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
derby = require '../lib/derby'
ui = require './fixtures/components/ui'

describe 'Component libraries', ->

  it 'supports createLibrary', ->
    derby.use ui
    