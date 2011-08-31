uglify = require 'uglify-js'
module.exports = View = require './View'
Dom = require './Dom'
modelHelper = require './modelHelper'

View::_register = (name, before, after, fn) ->
  @preLoad before  if before
  @preLoad after  if after
  @_views[name] = fn

View::sendHtml = (res, model) ->
  # Initialize view for rendering
  dom = @dom = new Dom(@model = modelHelper.init model)
  @_idCount = 0

  # The view.get function renders and sets event listeners. It must be
  # called for all views before the event listeners are retrieved
  
  # The first chunk includes everything through head. It is important to get
  # CSS to the browser as soon as possible, so styles should definately be
  # within the Head view. In addition, the Head view does not have to be the
  # same thing as the contents of the HTML head element, and if there is small
  # amount of header HTML that will display well by iteself, it is a good idea
  # to add this to the Head view so that it renders ASAP.
  doctype = @get('Doctype') || '<!DOCTYPE html><meta charset=utf-8>'
  title = @get('Title') || 'Derby app'
  head = @get 'Head'
  res.write "#{doctype}<title>#{title}</title>#{head}"

  # Remaining HTML
  res.write @get 'Body'

  # preLoad scripts and external script
  res.write "<script>function $(i){return document.getElementById(i)}" +
    "#{minify @_loadFuncs}</script>" +
    "<script defer async onload=i() src=#{@_jsFile}></script>"
  
  # Initialization script and Tail
  tail = @get 'Tail'
  initScript = "<script defer>i=function(){setTimeout(function(){#{@_clientName}" +
    "=require('./#{@_clientName}')(" + @_idCount + ','
  
  # Wait for transactions to finish and package up the racer model data
  model.bundle (bundle) ->
    res.end initScript + bundle.replace(/<\//g, '<\\/') + ',' +
      JSON.stringify(model.__events.get()) + ',' +
      JSON.stringify(dom.events.get()) + ");delete window.i},0)}</script>#{tail}"

cache = {}
minify = (js) ->
  return cache[js]  if cache[js]
  cache[js] = uglify js
