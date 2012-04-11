{expect, calls} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
View = require '../src/View.server'

describe 'View components', ->

  it 'supports void components', ->
    view = new View
    view._init new Model

    view.make 'test', 'say "<app:test2>"'
    view.make 'test2', 'hi'
    expect(view.get 'test').to.equal 'say "hi"'

  it 'supports literal attributes', ->
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

  it 'supports variable attributes', ->
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

  it 'supports variable object attributes', ->
    view = new View
    view._init new Model

    view.make 'test', 'say "<app:test2 message="{{myMessage}}">"'
    view.make 'test2', '''
      {{{#with message}}}
        {{text}}
      {{{/}}}
    '''
    expect(view.get 'test', myMessage: {text: 'Heyo'}).to.equal 'say "Heyo"'

  it 'supports dot syntax for properties of variable object attributes', ->
    view = new View
    view._init new Model

    view.make 'test', 'say "<app:test2 message="{{myMessage}}">"'
    view.make 'test2', '''
      {{{message.text}}}
    '''
    expect(view.get 'test', myMessage: {text: 'Heyo'}).to.equal 'say "Heyo"'

  it 'supports bound attributes', ->
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

  it 'supports bound attributes as element attributes', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', 'say "<app:test2 message="{myMessage}">"'
    view.make 'test2', '''
      <div title={{{message}}}></div>
    '''
    model.set 'myMessage', 'Heyo'
    expect(view.get 'test').to.equal 'say "<div id=$0 title=Heyo></div>"'

  it 'supports nonvoid components', ->
    view = new View
    view._init new Model

    view.make 'test', '<ul><app:test2><b>Hi!</b></app:test2></ul>'
    view.make 'test2', '<li>{{{content}}}</li>', {nonvoid: null}
    expect(view.get 'test').to.equal '<ul><li><b>Hi!</b></li></ul>'
