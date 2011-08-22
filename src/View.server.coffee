uglify = require 'uglify-js'
module.exports = View = require './View'
Dom = require './Dom'
modelHelper = require './modelHelper'

View::_register = (name, after, fn) ->
  @preLoad after  if after
  @_views[name] = fn

View::html = (model, callback) ->
  # Initialize view for rendering
  dom = @dom = new Dom(@model = modelHelper.init model)
  @_idCount = 0

  # Render the page
  title = @get 'Title'
  head = @get 'Head'
  body = @get 'Body'
  foot = @get 'Foot'

  html = "<!DOCTYPE html><title>#{title}</title>#{head}#{body}" +
  "<script>function $(i){return document.getElementById(i)}" +
  "#{minify @_loadFuncs}</script>" +
  "<script src=#{@_jsFile}></script>" +
  "<script>setTimeout(function(){window.#{@_clientName}" +
  "=require('./#{@_clientName}')(" + @_idCount + ','

  # Wait for transactions to finish and ackage up the racer model data
  model.bundle (bundle) ->
    callback html + bundle.replace(/<\//g, '<\\/') + ',' +
      JSON.stringify(model.__events.get()) + ',' +
      JSON.stringify(dom.events.get()) + ")},0)</script>#{foot}"

cache = {}
minify = (js) ->
  return cache[js]  if cache[js]
  cache[js] = uglify js