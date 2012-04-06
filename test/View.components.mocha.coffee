{expect, calls} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
View = require '../src/View.server'

describe 'View components', ->

  it 'supports void html components', ->
    view = new View
    view._init new Model

    view.make 'test', 'say "<app:test2>"'
    view.make 'test2', 'hi'

    expect(view.get 'test').to.equal 'say "hi"'

  it 'supports void html components with attributes', ->
    view = new View
    view._init new Model

    view.make 'test', 'say "<app:test2 message="Howdy">" or "<app:test2>"'
    view.make 'test2', '''
      {{{#if message}}}
        {{{message}}}
      {{{else}}}
        Yo
      {{{/}}}
    '''

    expect(view.get 'test').to.equal 'say "Howdy" or "Yo"'
