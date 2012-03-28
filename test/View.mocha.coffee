{expect, calls} = require 'racer/test/util'
{Model} = require 'racer'
View = require '../src/View.server'

describe 'View', ->

  ResMock = ->
    @html = ''
    return
  ResMock:: =
    getHeader: ->
    setHeader: ->
    write: write = (value) ->
      @html += value
    send: write
    end: (value) ->
      write value
      @onEnd? @html

  Model::_commit = ->
  Model::bundle = ->

  it 'view.render with no defined views', ->
    view = new View
    res = new ResMock
    res.onEnd = (html) ->
      expect(html).to.match /^<!DOCTYPE html><meta charset=utf-8><title>.*<\/title><script>.*<\/script><script.*><\/script>$/
    view.render res

  it 'rendering a string literal view', ->
    view = new View
    view._init new Model

    view.make 'test', """
      <style>
        body {
          margin: 
            0
        }
      </style>
      """
    # String views should have line breaks and leading whitespace removed
    expect(view.get 'test').to.eql '<style>body {margin: 0}</style>'

  it 'substituting variables into text', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', '''
      {{connected}}{{canConnect}} {{nada}}
      <p>
        {{name}}
      </p>
      <p>
        {{age}} - {{height}} - {{weight}}
      </p>
      '''
    ctx =
      connected: false
      weight: '165 lbs'
      nada: null

    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'height', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    expected = 'falsetrue ' +
      '<p>John</p>' +
      '<p>22 - 6 ft 2 in - 165 lbs</p>'

    expect(view.get 'test', ctx).to.equal expected

  it 'binding variables in text', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', '''
      ((connected))((canConnect)) ((nada))
      <p>
        ((name))
      </p>
      <p>
        ((age)) - ((height)) - ((weight))
      </p>
      '''
    ctx =
      connected: false
      weight: '165 lbs'
      nada: null

    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'height', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    expect(view.get 'test', ctx).to.equal '<!--$0-->false<!--$$0--><!--$1-->true<!--$$1--> <!--$2--><!--$$2-->' +
      '<p id=$3>John</p>' +
      '<p><!--$4-->22<!--$$4--> - <!--$5-->6 ft 2 in<!--$$5--> - <!--$6-->165 lbs<!--$$6--></p>'

  it 'HTML escaping', ->
    view = new View
    model = new Model
    view._init model

    # Attribute values are escaped regardless of placeholder type
    # Ampersands are escaped at the end of a replacement even when not
    # required, because it is sometimes needed depending on the following item
    template = '''<input value=(((html)))> ((html))x(((html)))'''
    value = '<b id="hey">&Hi! & x& </b>&'
    expected =
      '<input id=$0 value="<b id=&quot;hey&quot;>&amp;Hi! & x& </b>&amp;"> ' +
      '<!--$1-->&lt;b id="hey">&amp;Hi! & x& &lt;/b>&amp;<!--$$1-->x' +
      '<!--$2--><b id="hey">&Hi! & x& </b>&<!--$$2-->'

    view.make 'test1', template
    expect(view.get 'test1', html: value).to.eql expected

    view._idCount = 0
    model.set 'html', value
    expect(view.get 'test1').to.eql expected

    view.make 'test2',
      '<p a={{a}} b={{b}} c={{c}} d={{d}} e={{e}} f={{f}} g={{g}} h={{h}} i>'
    expect(view.get 'test2',
      {a: '"', b: "'", c: '<', d: '>', e: '=', f: ' ', g: '', h: null}
    ).to.eql '<p a=&quot; b="\'" c="<" d=">" e="=" f=" " g="" h="" i>'

  it 'conditional blocks in text', ->
    view = new View
    model = new Model
    view._init model

    view.make 'literal',
      '{{#if show}}Yep{{else}}Nope{{/}}{{#if show}} Yes!{{/}} {{#unless show}}No{{/}}'
    view.make 'bound',
      '((#if show))Yep((else))Nope((/))((#if show)) Yes!((/)) ((#unless show))No((/))'

    literalTruthy = 'Yep Yes! '
    literalFalsey = 'Nope No'
    modelTruthy = '<!--$0-->Yep<!--$$0--><!--$1--> Yes!<!--$$1--> <!--$2--><!--$$2-->'
    modelFalsey = '<!--$0-->Nope<!--$$0--><!--$1--><!--$$1--> <!--$2-->No<!--$$2-->'

    expect(view.get 'literal', show: true).to.eql literalTruthy
    expect(view.get 'literal', show: 1).to.eql literalTruthy
    expect(view.get 'literal', show: 'x').to.eql literalTruthy
    expect(view.get 'literal', show: {}).to.eql literalTruthy
    expect(view.get 'literal', show: [1]).to.eql literalTruthy

    expect(view.get 'literal', show: false).to.eql literalFalsey
    expect(view.get 'literal', show: undefined).to.eql literalFalsey
    expect(view.get 'literal', show: null).to.eql literalFalsey
    expect(view.get 'literal', show: 0).to.eql literalFalsey
    expect(view.get 'literal', show: '').to.eql literalFalsey
    expect(view.get 'literal', show: []).to.eql literalFalsey
    expect(view.get 'literal').to.eql literalFalsey

    # No parameter assumes it is a model path that is undefined
    view._idCount = 0
    expect(view.get 'bound').to.eql modelFalsey

    view._idCount = 0
    model.set 'show', true
    expect(view.get 'bound').to.eql modelTruthy
    view._idCount = 0
    model.set 'show', 1
    expect(view.get 'bound').to.eql modelTruthy
    view._idCount = 0
    model.set 'show', 'x'
    expect(view.get 'bound').to.eql modelTruthy
    view._idCount = 0
    model.set 'show', {}
    expect(view.get 'bound').to.eql modelTruthy

    view._idCount = 0
    model.set 'show', false
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', undefined
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', null
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', 0
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', ''
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', []
    expect(view.get 'bound').to.eql modelFalsey

  it 'lists in text', ->
    view = new View
    view._init new Model

    template = """
    <ul>
    {{#each arr}}
      <li>{{name}}
    {{else}}
      <li>Nothing to see
    {{/}}
    </ul>
    """

    view.make 'test', template
    expect(view.get 'test', arr: [])
      .to.eql '<ul><li>Nothing to see</ul>'

    view.make 'test', template
    expect(view.get 'test', arr: [{name: 'stuff'}, {name: 'more'}])
      .to.eql '<ul><li>stuff<li>more</ul>'

  it 'boolean attributes', ->
    view = new View
    view._init new Model

    view.make 'test', '<input disabled=((maybe))>'

    expect(view.get 'test').to.equal '<input id=$0>'
    expect(view.get 'test', maybe: false).to.equal '<input id=$1>'
    expect(view.get 'test', maybe: true).to.equal '<input id=$2 disabled>'

  it 'paths containing dots should work for ctx object items', ->
    view = new View
    view._init new Model

    view.make 'test', '<b>{{user.name}}</b>'
    ctx = user: {name: 'John'}

    expect(view.get 'test', ctx).to.equal '<b>John</b>'

  it 'relative paths should work for ctx object items', ->
    view = new View
    view._init new Model

    view.make 'test', '{{#if user}}<b>{{.name}}</b>{{/}}'
    ctx = user: {name: 'John'}

    expect(view.get 'test', ctx).to.equal '<b>John</b>'

  it 'Arrays containing non-objects should work from ctx', ->
    view = new View
    view._init new Model

    view.make 'test1', '{{#each bools}}<b>{{this}}</b>{{/}}'
    view.make 'test2', '{{#each bools as :value}}<b>{{:value}}</b>{{/}}'
    ctx = bools: [true, false, true]

    expect(view.get 'test1', ctx).to.equal '<b>true</b><b>false</b><b>true</b>'
    expect(view.get 'test2', ctx).to.equal '<b>true</b><b>false</b><b>true</b>'

  it 'views should support helper functions', ->
    view = new View
    model = new Model
    view._init model

    view.fn 'lower', (s) -> s.toLowerCase()

    view.make 'test', '''{{lower('HI')}} ((lower( "HI" )))'''
    expect(view.get 'test').to.equal 'hi <!--$0-->hi<!--$$0-->'

    view.fn 'sum', (a, b) -> a + b
    view.fn 'equal', (a, b) -> a == b

    view.make 'test', '{{sum(4, 9)}}'
    expect(view.get 'test').to.equal '13'

    view._idCount = 0
    view.make 'test', '(((equal(1, sum(-5, 6)))))'
    expect(view.get 'test').to.equal '<!--$0-->true<!--$$0-->'

    view._idCount = 0
    view.make 'test', '(((equal(sum(-5, 6), 1))))'
    expect(view.get 'test').to.equal '<!--$0-->true<!--$$0-->'

    view.make 'test', '{{sum(4, count)}}'
    expect(view.get 'test', {count: 7}).to.equal '11'
    model.set 'count', 13
    expect(view.get 'test').to.equal '17'
