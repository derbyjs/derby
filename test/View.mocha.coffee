expect = require 'expect.js'
Model = require '../node_modules/racer/src/Model.server'
View = require '../src/View.server'

describe 'View', ->

  ResMock = ->
    @html = ''
    return
  ResMock:: =
    getHeader: ->
    setHeader: ->
    write: write = (value) -> @html += value
    send: write
    end: write

  Model::_commit = ->
  Model::bundle = ->

  it 'test view.render with no defined views', ->
    view = new View
    res = new ResMock
    view.render res
    setTimeout ->
      expect(res.html).to.match /^<!DOCTYPE html><meta charset=utf-8><title>.*<\/title><script>.*<\/script><script.*><\/script>$/
    , 100

  it 'test rendering a string literal view', ->
    view = new View
    model = new Model
    view._init model

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

  it 'test substituting variables into text', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', '''
      {{connected}}{{canConnect}} {{nada}}
      <p>{{name}}
      <p>{{age}} - {{height}} - {{weight}}
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
      '<p>John' +
      '<p>22 - 6 ft 2 in - 165 lbs'

    expect(view.get 'test', ctx).to.eql expected

  it 'test binding variables in text', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', '''
      ((connected))((canConnect)) ((nada))
      <p>((name))
      <p>((age)) - ((height)) - ((weight))
      '''
    ctx =
      connected: false
      weight: '165 lbs'
      nada: null

    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'height', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    expect(view.get 'test', ctx).to.eql '<!--$0-->false<!--$$0--><!--$1-->true<!--$$1--> <!--$2--><!--$$2-->' +
      '<p id=$3>John' +
      '<p><!--$4-->22<!--$$4--> - <!--$5-->6 ft 2 in<!--$$5--> - <!--$6-->165 lbs<!--$$6-->'

  it 'test HTML escaping', ->
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

  it 'test conditional blocks in text', ->
    view = new View
    model = new Model
    view._init model

    view.make 'literal',
      '{{#show}}Yep{{^}}Nope{{/}}{{#show}} Yes!{{/}} {{^show}}No{{/}}'
    view.make 'bound',
      '((#show))Yep((^))Nope((/))((#show)) Yes!((/)) ((^show))No((/))'

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

  it 'test lists in text', ->
    view = new View
    model = new Model
    view._init model

    template = """
    <ul>
    {{#arr}}
      <li>{{name}}
    {{^}}
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

  it 'test boolean attributes', ->
    view = new View
    model = new Model
    view._init model

    view.make 'test', '<input disabled=((maybe))>'

    expect(view.get 'test').to.eql '<input id=$0>'
    expect(view.get 'test', maybe: false).to.eql '<input id=$1>'
    expect(view.get 'test', maybe: true).to.eql '<input id=$2 disabled>'
