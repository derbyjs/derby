{Model} = require 'racer'
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

escapeInlineScript = (s) -> s.replace /<\//g, '<\\/'

# Don't execute before or after functions on the server
View::before = View::after = ->

View::inline = (fn) -> @_inline += uglify("(#{fn})()") + ';'

View::_load = (isStatic, callback) ->
  if loader.isProduction then @_load = (isStatic, callback) -> callback()
  return loader.views this, @_root, @_clientName, callback  if isStatic
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

View::render = (res = emptyRes, args...) ->
  for arg in args
    if arg instanceof Model
      model = arg
    else if typeof arg is 'object'
      ctx = arg
    else if typeof arg is 'number'
      res.statusCode = arg
    else if typeof arg is 'boolean'
      isStatic = arg
  model = emptyModel  unless model?

  self = this
  @_init model
  dom = @dom
  @_load isStatic, -> loader.css self._root, self._clientName, (css) ->
    self._render res, model, ctx, isStatic, dom, css

View::_render = (res, model, ctx, isStatic, dom, css) ->
  unless res.getHeader 'content-type'
    res.setHeader 'Content-Type', 'text/html; charset=utf-8'
  
  # The view.get function renders and sets event listeners. It must be
  # called for all views before the event listeners are retrieved
  
  # The first chunk includes everything through header. Head should contain
  # any meta tags and script tags, since it is included before CSS.
  # If there is a small amount of header HTML that will display well by itself,
  # it is a good idea to add this to the Header view so that it renders ASAP.
  doctype = @get('doctype', ctx) || '<!DOCTYPE html><meta charset=utf-8>'
  title = View.htmlEscape(@get 'title$s', ctx) || 'Derby app'
  head = @get 'head', ctx
  header = @get 'header', ctx
  css = "<style>#{css}</style>"  if css
  res.write "#{doctype}<title>#{title}</title>#{head}#{css}#{header}"

  # Remaining HTML
  res.write @get 'body', ctx

  # Inline scripts and external scripts
  clientName = @_clientName
  scripts = "<script>function $(i){return document.getElementById(i)}" +
    escapeInlineScript(@_inline)
  scripts += "function #{clientName}(){#{clientName}=1}"  unless isStatic
  scripts += "</script>" + @get('script', ctx)
  scripts += "<script defer async onload=#{clientName}() src=#{@_jsFile}></script>"  unless isStatic
  res.write scripts

  # Initialization script and Tail
  tail = @get 'tail', ctx
  return res.end tail  if isStatic
  
  initStart = "<script>(function(){function f(){setTimeout(function(){" +
    "#{clientName}=require('./#{@_require}')(#{@_idCount}," +
    JSON.stringify(@_paths) + ',' + JSON.stringify(@_partialIds) + ',' +
    JSON.stringify(@_aliases) + ',' + model.__pathMap.count + ',' +
    JSON.stringify(model.__pathMap.ids) + ','
  initEnd = ',' + JSON.stringify(model.__events.get()) + ',' +
    JSON.stringify(dom.events.get()) +
    ")},0)}#{clientName}===1?f():#{clientName}=f})()</script>#{tail}"
  
  # Wait for transactions to finish and package up the racer model data
  model.bundle (bundle) ->
    res.end initStart + escapeInlineScript(bundle) + initEnd
