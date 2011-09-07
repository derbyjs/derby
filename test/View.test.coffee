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
      <p>{{age}} - {{height}} - {{weight}}
      """,
      connected: false
      height: {model: 'newHeight'}
      weight: '165 lbs'
    
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

    view.make 'test',
      '<input value={{html}}> {{html}} {{{html}}}',
      html: '<b id="hey">&Hi!</b>'
    
    view.get('test').should.eql '<input value="<b id=&quot;hey&quot;>&Hi!</b>"> ' +
      '&lt;b id="hey"&gt;&amp;Hi!&lt;/b&gt; ' +
      '<b id="hey">&Hi!</b>'

  'test conditional blocks in text': ->
    view = new View
    model = new Model
    view._init model
    
    view.make 'test', """
      {{#show}}<p>{{#user}}<b>{{name}}</b>  
      """,
      connected: false
      height: {model: 'newHeight'}
      weight: '165 lbs'
    
    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'newHeight', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    view.get('test').should.eql 'false - <ins id=$0>true</ins>' +
      '<p id=$1>John' +
      '<p><ins id=$2>22</ins> - <ins id=$3>6 ft 2 in</ins> - 165 lbs'
