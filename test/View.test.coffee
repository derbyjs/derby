{wrapTest} = require './util'
Model = require '../node_modules/racer/src/Model.server'
should = require 'should'
View = require 'View.server'

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

module.exports =
  'test sendHtml with no defined views': ->
    view = new View
    model = new Model
    res = new ResMock
    view.sendHtml res, model
    res.html.should.match /^<!DOCTYPE html><meta charset=utf-8><title>.*<\/title><script>.*<\/script><script.*><\/script>$/
        
  'test rendering a string literal view': ->
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
    view.get('test').should.eql '<style>body {margin: 0}</style>'
        
  'test substituting variables into text': ->
    view = new View
    model = new Model
    view._init model
          
    template = """
      {{connected}}{{canConnect}} {{nada}}
      <p>{{name}}
      <p>{{age}} - {{height}} - {{weight}}
      """
    ctx =
      connected: false
      height: {model: 'newHeight'}
      weight: '165 lbs'
      nada: null
        
    view.make 'test0', template, ctx
    view.make 'test1', template
        
    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'newHeight', '6 ft 2 in'
    model.set 'weight', '175 lbs'
        
    expected = 'falsetrue ' +
      '<p>John' +
      '<p>22 - 6 ft 2 in - 165 lbs'
        
    view.get('test0').should.eql expected
    view.get('test1', ctx).should.eql expected
        
  'test binding variables in text': ->
    view = new View
    model = new Model
    view._init model
        
    template = """
      ((connected))((canConnect)) ((nada))
      <p>((name))
      <p>((age)) - ((height)) - ((weight))
      """
    ctx =
      connected: false
      height: {model: 'newHeight'}
      weight: '165 lbs'
      nada: null
        
    view.make 'test0', template, ctx
    view.make 'test1', template
        
    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'newHeight', '6 ft 2 in'
    model.set 'weight', '175 lbs'
        
    expected = 'false<ins id=$0>true</ins> ' +
      '<p id=$1>John' +
      '<p><ins id=$2>22</ins> - <ins id=$3>6 ft 2 in</ins> - 165 lbs'
        
    view.get('test0').should.eql 'false<ins id=$0>true</ins> ' +
      '<p id=$1>John' +
      '<p><ins id=$2>22</ins> - <ins id=$3>6 ft 2 in</ins> - 165 lbs'
    view._idCount = 0
    view.get('test1', ctx).should.eql '<ins id=$0>false</ins><ins id=$1>true</ins> <ins id=$2></ins>' +
      '<p id=$3>John' +
      '<p><ins id=$4>22</ins> - <ins id=$5>6 ft 2 in</ins> - <ins id=$6>165 lbs</ins>'
        
  'test HTML escaping': ->
    view = new View
    model = new Model
    view._init model
              
    # Attribute values are escaped regardless of placeholder type
    # Ampersands are escaped at the end of a replacement even when not
    # required, because it is sometimes needed depending on the following item
    template = '<input value=(((html)))> ((html))x(((html)))'
    value = '<b id="hey">&Hi! & x& </b>&'
              
    view.make 'test0', template, html: value
    view.get('test0').should.eql '<input value="<b id=&quot;hey&quot;>&amp;Hi! & x& </b>&amp;"> ' +
      '&lt;b id="hey">&amp;Hi! & x& &lt;/b>&amp;x' +
      '<b id="hey">&Hi! & x& </b>&'
              
    view.make 'test1', template
    model.set 'html', value
    view.get('test1').should.eql '<input value="<b id=&quot;hey&quot;>&amp;Hi! & x& </b>&amp;" id=$0> ' +
      '<ins id=$1>&lt;b id="hey">&amp;Hi! & x& &lt;/b>&amp;</ins>x' +
      '<ins id=$2><b id="hey">&Hi! & x& </b>&</ins>'
              
    view.make 'test2', '<p a={{a}} b={{b}} c={{c}} d={{d}} e={{e}} f={{f}} g={{g}} h={{h}} i>',
      {a: '"', b: "'", c: '<', d: '>', e: '=', f: ' ', g: '', h: null}
    view.get('test2').should.eql '<p a=&quot; b="\'" c="<" d=">" e="=" f=" " g="" h="" i>'
              
  'test conditional blocks in text': ->
    view = new View
    model = new Model
    view._init model
        
    template = '((#show))Yep((^))Nope((/))((#show)) Yes!((/)) ((^show))No((/))'
        
    literalTruthy = 'Yep Yes! '
    literalFalsey = 'Nope No'
    modelTruthy = '<ins id=$0>Yep</ins><ins id=$1> Yes!</ins> <ins id=$2></ins>'
    modelFalsey = '<ins id=$0>Nope</ins><ins id=$1></ins> <ins id=$2>No</ins>'
        
    view.make 'test', template, show: true
    view.get('test').should.eql literalTruthy
    view.make 'test', template, show: 1
    view.get('test').should.eql literalTruthy
    view.make 'test', template, show: 'x'
    view.get('test').should.eql literalTruthy
    view.make 'test', template, show: {}
    view.get('test').should.eql literalTruthy
        
    view.make 'test', template, show: false
    view.get('test').should.eql literalFalsey
    view.make 'test', template, show: undefined
    view.get('test').should.eql literalFalsey
    view.make 'test', template, show: null
    view.get('test').should.eql literalFalsey
    view.make 'test', template, show: 0
    view.get('test').should.eql literalFalsey
    view.make 'test', template, show: ''
    view.get('test').should.eql literalFalsey
    view.make 'test', template, show: []
    view.get('test').should.eql literalFalsey
        
    view.make 'test', template
        
    # No parameter assumes it is a model path that is undefined
    view._idCount = 0
    view.get('test').should.eql modelFalsey
        
    view._idCount = 0
    model.set 'show', true
    view.get('test').should.eql modelTruthy
    view._idCount = 0
    model.set 'show', 1
    view.get('test').should.eql modelTruthy
    view._idCount = 0
    model.set 'show', 'x'
    view.get('test').should.eql modelTruthy
    view._idCount = 0
    model.set 'show', {}
    view.get('test').should.eql modelTruthy
        
    view._idCount = 0
    model.set 'show', false
    view.get('test').should.eql modelFalsey
    view._idCount = 0
    model.set 'show', undefined
    view.get('test').should.eql modelFalsey
    # TODO: Fix bug in Racer
    # view._idCount = 0
    # model.set 'show', null
    # view.get('test').should.eql modelFalsey
    view._idCount = 0
    model.set 'show', 0
    view.get('test').should.eql modelFalsey
    view._idCount = 0
    model.set 'show', ''
    view.get('test').should.eql modelFalsey
    view._idCount = 0
    model.set 'show', []
    view.get('test').should.eql modelFalsey

  'test lists in text': ->
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

    view.make 'test', template, arr: []
    view.get('test').should.eql '<ul><li>Nothing to see</ul>'

    view.make 'test', template, arr: [{name: 'stuff'}, {name: 'more'}]
    view.get('test').should.eql '<ul><li>stuff<li>more</ul>'

  'test boolean attributes': ->
    view = new View
    model = new Model
    view._init model

    template = '<input type=checkbox checked=((maybe))>'

    view.make 'test', template
    view.get('test').should.eql '<input type=checkbox id=$0>'
    view.make 'test', template, maybe: false
    view.get('test').should.eql '<input type=checkbox>'
    view.make 'test', template, maybe: true
    view.get('test').should.eql '<input type=checkbox checked>'

