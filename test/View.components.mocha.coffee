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

  it 'supports void html components with literal attributes', ->
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

  it 'supports void html components with variable attributes', ->
    view = new View
    view._init new Model

    view.make 'test', 'say "<app:test2 message="{{myMessage}}">"'
    view.make 'test2', '''
      {{{#if message}}}
        {{{message}}}
      {{{else}}}
        Yo
      {{{/}}}
    '''
    expect(view.get 'test').to.equal 'say "Yo"'
    expect(view.get 'test', myMessage: 'Heyo').to.equal 'say "Heyo"'

  it 'supports void html components with bound attributes', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', 'say "<app:test2 message="{myMessage}">"'
    view.make 'test2', '''
      {{{#if message}}}
        {{{message}}}
      {{{else}}}
        Yo
      {{{/}}}
    '''
    model.set 'myMessage', 'Heyo'
    expect(view.get 'test').to.equal 'say "<!--$0--><!--$1-->Heyo<!--$$1--><!--$$0-->"'
