uglify = require 'uglify-js'
module.exports = View = require './View'
Dom = require './Dom'
modelHelper = require './modelHelper'
loader = require './loader'

empty = ->
emptyRes =
  getHeader: empty
  setHeader: empty
  write: empty
  end: empty
emptyModel =
  get: empty
  bundle: empty

# Don't execute before or after functions on the server
View::before = View::after = ->

View::inline = (fn) -> @_inline += uglify("(#{fn})()") + ';'

View::_load = (callback) ->
  if loader.isProduction then @_load = (callback) -> callback()
  self = this
  loader.js this, @_appFilename, @_derbyOptions, (obj) ->
    self._root = obj.root
    self._clientName = obj.clientName
    self._jsFile = obj.jsFile
    self._require = obj.require
    callback()

View::_init = (model) ->
  # Initialize view for rendering
  @dom = new Dom(@model = modelHelper.init model)
  @_idCount = 0

View::send = (res = emptyRes, model = emptyModel, ctx) ->
  self = this
  @_init model
  dom = @dom
  @_load -> loader.css self._root, self._clientName, (css) ->
    self._send res, model, ctx, dom, css

View::_send = (res, model, ctx, dom, css) ->
  unless res.getHeader 'content-type'
    res.setHeader 'Content-Type', 'text/html; charset=utf-8'
  
  # The view.get function renders and sets event listeners. It must be
  # called for all views before the event listeners are retrieved
  
  # The first chunk includes everything through header. Head should contain
  # any meta tags and script tags, since it is included before CSS.
  # If there is a small amount of header HTML that will display well by itself,
  # it is a good idea to add this to the Header view so that it renders ASAP.
  doctype = @get('Doctype', ctx) || '<!DOCTYPE html><meta charset=utf-8>'
  title = View.htmlEscape(@get 'Title$s', ctx) || 'Derby app'
  head = @get 'Head', ctx
  header = @get 'Header', ctx
  res.write "#{doctype}<title>#{title}</title>#{head}<style>#{css}</style>#{header}"

  # Remaining HTML
  res.write @get 'Body', ctx

  # preLoad scripts and external script
  clientName = @_clientName
  res.write "<script>function $(i){return document.getElementById(i)}" +
    "function #{clientName}(){#{clientName}=1}" +
    "#{@_inline}</script>" + @get('Script', ctx) +
    "<script defer async onload=#{clientName}() src=#{@_jsFile}></script>"
  
  # Initialization script and Tail
  tail = @get 'Tail', ctx
  initStart = "<script>(function(){function f(){setTimeout(function(){" +
    "#{clientName}=require('./#{@_require}')(#{@_idCount}," +
    JSON.stringify(@_paths) + ',' + JSON.stringify(@_partialIds) + ',' +
    JSON.stringify(@_aliases) + ',' + JSON.stringify(@_depths) + ','
  initEnd = ',' + JSON.stringify(model.__events.get()) + ',' +
      JSON.stringify(dom.events.get()) +
      ")},0)}#{clientName}===1?f():#{clientName}=f})()</script>#{tail}"
  
  # Wait for transactions to finish and package up the racer model data
  model.bundle (bundle) ->
    res.end initStart + bundle.replace(/<\//g, '<\\/') + initEnd

