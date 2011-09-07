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

Model::bundle = ->

module.exports =
  'test sendHtml with no defined views': ->
    view = new View
    model = new Model
    res = new ResMock
    view.sendHtml res, model
    res.html.should.match /^<!DOCTYPE html><meta charset=utf-8><title>.*<\/title><script>.*<\/script><script.*><\/script>$/

  
