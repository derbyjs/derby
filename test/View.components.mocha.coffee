{expect, calls} = require 'racer/test/util'
{DetachedModel: Model} = require './mocks'
View = require '../lib/View.server'

describe 'App HTML components', ->
  view = model = null

  beforeEach (done) ->
    view = new View
    model = new Model
    view._init model, false, done

  it 'supports void components', ->
    view.make 'test', 'say "<app:test2>"'
    view.make 'test2', 'hi'
    expect(view.get 'test').to.equal 'say "hi"'

  it 'supports <derby:view view="name"> lookup', ->
    view.make 'test', 'say "<derby:view view=test2>"'
    view.make 'test2', 'hi'
    expect(view.get 'test').to.equal 'say "hi"'

  it 'supports <derby:view view="{{name}}"> lookup', ->
    view.make 'test', 'say "<derby:view view={{template}}>"'
    view.make 'test2', 'hi'
    expect(view.get 'test', {template: 'test2'}).to.equal 'say "hi"'

  it 'supports <derby:view view="{{@name}}"> lookup', ->
    view.make 'test', '<app:test2 template=test3>'
    view.make 'test2', 'say "<derby:view view={{@template}}>"'
    view.make 'test3', 'hi'
    expect(view.get 'test').to.equal 'say "hi"'

  it 'supports <derby:view view="{{@name}}"> lookup via inherit', ->
    view.make 'test', '<app:test2 view=test3>'
    view.make 'test2', 'say "<derby:view inherit>"'
    view.make 'test3', 'hi'
    expect(view.get 'test').to.equal 'say "hi"'

  it 'supports literal attributes', ->
    view.make 'test', 'say "<app:test2 message="Howdy">" or "<app:test2>"'
    view.make 'test2', '''
      {{#if @message}}
        {{@message}}
      {{else}}
        Yo
      {{/}}
    '''
    expect(view.get 'test').to.equal 'say "Howdy" or "Yo"'

  it 'macro attributes are case-insensitive', ->
    view.make 'test', 'say "<app:test2 messAGE="Howdy">" or "<app:test2>"'
    view.make 'test2', '''
      {{#if @messAGE}}
        {{@message}}
      {{else}}
        Yo
      {{/}}
    '''
    expect(view.get 'test').to.equal 'say "Howdy" or "Yo"'

  it 'supports boolean and numerical attributes', ->
    view.make 'test', '<app:test2 show> / <app:test2 num="-4.5"> / <app:test2>'
    view.make 'test2', '''
      {{#if @show}}
        Hi
      {{else if equal(@num, -4.5)}}
        Got it
      {{else}}
        Nada
      {{/}}
    '''
    expect(view.get 'test').to.equal 'Hi / Got it / Nada'

  it 'supports variable attributes', ->
    view.make 'test', 'say "<app:test2 message="{{myMessage}}">"'
    view.make 'test2', '''
      {{#if @message}}
        {{@message}}
      {{else}}
        Yo
      {{/}}
    '''
    expect(view.get 'test').to.equal 'say "Yo"'
    expect(view.get 'test', myMessage: 'Heyo').to.equal 'say "Heyo"'

  it 'supports variable object attributes', ->
    view.make 'test', 'say "<app:test2 message="{{myMessage}}">"'
    view.make 'test2', '''
      {{#with @message}}
        {{text}}
      {{/}}
    '''
    expect(view.get 'test', myMessage: {text: 'Heyo'}).to.equal 'say "Heyo"'

  it 'supports dot syntax for properties of variable object attributes', ->
    view.make 'test', 'say "<app:test2 message="{{myMessage}}">"'
    view.make 'test2', '''
      {{@message.text}}
    '''
    expect(view.get 'test', myMessage: {text: 'Heyo'}).to.equal 'say "Heyo"'

  it 'supports dot syntax for nested properties of variable object attributes', ->
    view.make 'test', 'say "<app:test2 messages="{{myMessages}}">"'
    view.make 'test2', '''
      {{@messages.0.text}}
    '''
    expect(view.get 'test', myMessages: [{text: 'Heyo'}]).to.equal 'say "Heyo"'

  it 'supports passing through literal attributes', ->
    view.make 'test', '<app:test2 message=Howdy>'
    view.make 'test2', '<app:test3 text={{@message}}>'
    view.make 'test3', '{{@text}}'
    expect(view.get 'test').to.equal 'Howdy'

  it 'supports passing through bound attributes', ->
    view.make 'test', '<app:test2 message={_stuff}>'
    view.make 'test2', '<app:test3 text={@message}>'
    view.make 'test3', '{{@text}}'
    model.set '_stuff', 'Howdy'
    expect(view.get 'test').to.equal 'Howdy'

  it 'supports this within scope from literal attribute', ->
    view.make 'test', 'say "<app:test2 message="Heyo">"'
    view.make 'test2', '''
      {{#with @message}}
        {{this}}
        {this}
      {{/}}
    '''
    expect(view.get 'test').to.equal 'say "Heyo<!--$0-->Heyo<!--$$0-->"'

  it 'supports bound attributes', ->
    view.make 'test', 'say "<app:test2 message="{myMessage}">"'
    view.make 'test2', '''
      {#if @message}
        {@message}
      {else}
        Yo
      {/}
    '''
    model.set 'myMessage', 'Heyo'
    expect(view.get 'test').to.equal 'say "<!--$0--><!--$1-->Heyo<!--$$1--><!--$$0-->"'

  it 'supports bound attributes as element attributes', ->
    view.make 'test', 'say "<app:test2 message="{myMessage}">"'
    view.make 'test2', '<div title={@message}></div>'
    model.set 'myMessage', 'Heyo'
    expect(view.get 'test').to.equal 'say "<div id=$0 title=Heyo></div>"'

  it 'supports blocks in attributes used in an attribute', ->
    view.make 'test', 'say "<app:test2 message="Say {{myMessage}}">"'
    view.make 'test2', '<div title="{{@message}}"></div>'
    model.set 'myMessage', 'Heyo'
    expect(view.get 'test').to.equal 'say "<div title="Say Heyo"></div>"'

  it 'supports bound blocks in attributes used in an attribute'
    # view.make 'test', 'say "<app:test2 message="Say {myMessage}">"'
    # view.make 'test2', '<div title="{@message}"></div>'
    # model.set 'myMessage', 'Heyo'
    # expect(view.get 'test').to.equal 'say "<div id=$0 title="Say Heyo"></div>"'

  it 'supports nonvoid components', ->
    view.make 'test', '<ul><app:test2><b>Hi!</b></app:test2></ul>'
    view.make 'test2', '<li>{{@content}}</li>', {nonvoid: true}
    expect(view.get 'test').to.equal '<ul><li><b>Hi!</b></li></ul>'

  it 'supports content sections', ->
    view.make 'test', '<ul><app:test2><@section><i>Heyo</i></@section><b>Hi!</b></app:test2></ul>'
    view.make 'test2', '<li>{{@content}}</li><li>{{@section}}</li>', {nonvoid: true}
    expect(view.get 'test').to.equal '<ul><li><b>Hi!</b></li><li><i>Heyo</i></li></ul>'
