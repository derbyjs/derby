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
    
    view.make 'test', """
      {{connected}} - {{canConnect}}
      <p>{{name}}
      <p>{{age}} - {{height}} - {{weight}}{{nada}}
      """,
      connected: false
      height: {model: 'newHeight'}
      weight: '165 lbs'
      nada: null
    
    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'newHeight', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    view.get('test').should.eql 'false - <ins id=$0>true</ins>' +
      '<p id=$1>John' +
      '<p><ins id=$2>22</ins> - <ins id=$3>6 ft 2 in</ins> - 165 lbs'

  'test HTML escaping': ->
    view = new View
    model = new Model
    view._init model

    # Attribute values are escaped regardless of placeholder type
    # Amphersands are escaped at the end of a replacement even when not
    # required, because it is sometimes needed depending on the following item
    template = '<input value={{{html}}}> {{html}}x{{{html}}}'
    value = '<b id="hey">&Hi! & x& </b>&'

    view.make 'test1', template, html: value
    view.get('test1').should.eql '<input value="<b id=&quot;hey&quot;>&amp;Hi! & x& </b>&amp;"> ' +
      '&lt;b id="hey">&amp;Hi! & x& &lt;/b>&amp;x' +
      '<b id="hey">&Hi! & x& </b>&'

    view.make 'test2', template
    model.set 'html', value
    view.get('test2').should.eql '<input value="<b id=&quot;hey&quot;>&amp;Hi! & x& </b>&amp;" id=$0> ' +
      '<ins id=$1>&lt;b id="hey">&amp;Hi! & x& &lt;/b>&amp;</ins>x' +
      '<ins id=$2><b id="hey">&Hi! & x& </b>&</ins>'

    view.make 'test3', '<p a={{a}} b={{b}} c={{c}} d={{d}} e={{e}} f={{f}} g={{g}} h={{h}} i>',
      {a: '"', b: "'", c: '<', d: '>', e: '=', f: ' ', g: '', h: null}
    view.get('test3').should.eql '<p a=&quot; b="\'" c="<" d=">" e="=" f=" " g="" h="" i>'

