uglify = require 'uglify-js'
module.exports = View = require './View'
Dom = require './Dom'
modelHelper = require './modelHelper'

# Override register so that before and after functions are not called
View::_register = (name, fn) ->
  @_views[name] = fn

View::_init = (model) ->
  # Initialize view for rendering
  @dom = new Dom(@model = modelHelper.init model)
  @_idCount = 0

View::sendHtml = (res, model) ->
  @_init model
  dom = @dom

  unless res.getHeader 'content-type'
    res.setHeader 'Content-Type', 'text/html; charset=utf-8'

  # The view.get function renders and sets event listeners. It must be
  # called for all views before the event listeners are retrieved

  # The first chunk includes everything through head. It is important to get
  # CSS to the browser as soon as possible, so styles should definately be
  # within the Head view. In addition, the Head view does not have to be the
  # same thing as the contents of the HTML head element, and if there is small
  # amount of header HTML that will display well by itself, it is a good idea
  # to add this to the Head view so that it renders ASAP.
  doctype = @get('Doctype') || '<!DOCTYPE html><meta charset=utf-8>'
  title = View.htmlEscape(@get 'Title') || 'Derby app'
  head = @get 'Head'
  res.write "#{doctype}<title>#{title}</title>#{head}"

  # Remaining HTML
  res.write @get 'Body'

  # preLoad scripts and external script
  clientName = @_clientName
  res.write "<script>function $(i){return document.getElementById(i)}" +
    "function #{clientName}(){#{clientName}=1}" +
    "#{minify @_loadFuncs}</script>" +
    "<script defer async onload=#{clientName}() src=#{@_jsFile}></script>"
  
  # Initialization script and Tail
  tail = @get 'Tail'
  initStart = "<script>(function(){function f(){setTimeout(function(){" +
    "#{clientName}=require('./#{clientName}')(#{@_idCount}," +
    JSON.stringify(@_paths) + ','
  initEnd = ',' + JSON.stringify(model.__events.get()) + ',' +
      JSON.stringify(dom.events.get()) +
      ")},0)}#{clientName}===1?f():#{clientName}=f})()</script>#{tail}"
  
  # Wait for transactions to finish and package up the racer model data
  model.bundle (bundle) ->
    res.end initStart + bundle.replace(/<\//g, '<\\/') + initEnd

cache = {}
minify = (js) ->
  return cache[js]  if cache[js]
  cache[js] = uglify js
