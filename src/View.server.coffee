uglify = require 'uglify-js'
module.exports = View = require './View'
Dom = require './Dom'
modelHelper = require './modelHelper'

View::_register = (name, after, fn) ->
  @preLoad after  if after
  @_views[name] = fn

View::html = (model) ->
  @dom = dom = new Dom(@model = modelHelper.init model)
  @_idCount = 0
  title = @get 'Title'
  head = @get 'Head'
  body = @get 'Body'
  foot = @get 'Foot'
  global = 'function $(i){return document.getElementById(i)}'
  "<!DOCTYPE html><title>#{title}</title>#{head}#{body}" +
  "<script>#{global}#{minify @_loadFuncs}</script>" +
  "<script src=#{@_jsFile}></script>" +
  "<script>setTimeout(function(){window.#{@_clientName}" +
  "=require('./#{@_clientName}')(" + @_idCount + ',' +
  JSON.stringify(model.get()).replace(/<\//g, '<\\/') + ',' +
  JSON.stringify(model.__events.get()) + ',' +
  JSON.stringify(dom.events.get()) + ")},0)</script>#{foot}"

minify (js) ->
  return store[js]  if store[js]
  store[js] = uglify js