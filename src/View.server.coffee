uglify = require 'racer/node_modules/uglify-js'
{Model, Promise} = racer = require 'racer'
{isProduction} = racer.util
EventDispatcher = require './EventDispatcher'
files = require './files'
{escapeHtml} = require './html'
{errorHtml, cssError, templateError} = require './refresh.server'
{trim} = module.exports = View = require './View'

empty = ->
emptyRes =
  getHeader: empty
  setHeader: empty
  write: empty
  end: empty
emptyPathMap =
  id: empty
emptyModel =
  get: empty
  bundle: empty
  __pathMap: emptyPathMap
emptyEventDispatcher =
  bind: empty
emptyDom =
  bind: empty

escapeInlineScript = (s) -> s.replace /<\//g, '<\\/'

# This is overridden but is here for testing
View::_appHashes = {}

View::inline = (fn) -> @_inline += uglify("(#{fn})()") + ';'

loadTemplatesScript = (requirePath, templates, instances) ->
  """
  (function() {
    require('#{requirePath}').view._makeAll(
      #{JSON.stringify templates, null, 2}, #{JSON.stringify instances, null, 2}
    );
  })();
  """

View::_load = (isStatic, callback) ->
  if isProduction
    @_load = (isStatic, callback) -> callback()
  else
    @_watch = true

  # Use a promise to avoid simultaneously loading multiple times
  if promise = @_loadPromise
    return promise.on callback
  promise = @_loadPromise = (new Promise).on callback

  # Once loading is complete, make the files reload from disk the next time
  promise.on => delete @_loadPromise

  templates = instances = js = null
  errors = {}

  if isStatic
    root = @_root
    clientName = @_clientName

    count = 2
    finish = ->
      return if --count
      promise.resolve()

  else
    appFilename = @_appFilename
    options = @_derbyOptions || {}
    {root, clientName, require} = files.parseName appFilename, options
    @_root = root
    promise.resolve() unless @_clientName = clientName
    @_require = require

    count = 3
    finish = =>
      return if --count

      # Templates are appended to the js bundle here so that it does
      # not have to be regenerated if only the template files are modified
      loadTemplates = loadTemplatesScript require, templates, instances
      loadTemplates = uglify loadTemplates if isProduction
      js += ';' + loadTemplates

      @_errors = errorHtml(errors) || ''

      files.writeJs root, js, options, (err, jsFile, appHash) =>
        throw err if err
        @_jsFile = jsFile
        @_appHashes[appFilename] = @_appHash = appHash
        promise.resolve()

    if @_js
      js = @_js
      finish()

    else files.js appFilename, (err, value, inline) =>
      throw err if err
      js = value
      @_js = value unless isProduction
      @inline "function(){#{inline}}"  if inline
      finish()

  files.css root, clientName, isProduction, (err, value) =>
    if err
      @_css = '<style id=$_css></style>'
      errors['CSS'] = cssError err
      return finish()
    value = if isProduction then trim value else '\n' + value
    @_css = if value then "<style id=$_css>#{value}</style>" else ''
    finish()

  files.templates root, clientName, (err, _templates, _instances) =>
    if err
      templates = {}
      instances = {}
      errors['Template'] = templateError err
    else
      templates = _templates
      instances = _instances
    @_makeAll templates, instances
    finish()

View::render = (res = emptyRes) ->
  for i in [1..5]
    arg = arguments[i]
    if arg instanceof Model
      model = arg
    else if typeof arg is 'object'
      ctx = arg
    else if typeof arg is 'string'
      ns = arg
    else if typeof arg is 'number'
      res.statusCode = arg
    else if typeof arg is 'boolean'
      isStatic = arg
  model = emptyModel  unless model?

  # Load templates, css, and scripts from files
  @_load isStatic, =>
    return @_render res, model, ns, ctx, isStatic  if isStatic

    # Wait for transactions to finish and package up the racer model data
    model.bundle (bundle) =>
      @_render res, model, ns, ctx, isStatic, bundle

View::_init = (model) ->
  # Initialize view & model for rendering
  @dom = emptyDom
  model.__events = emptyEventDispatcher
  model.__blockPaths = {}
  model.__pathMap = emptyPathMap
  @model = model
  @_idCount = 0

View::_render = (res, model, ns, ctx, isStatic, bundle) ->
  @_init model

  unless res.getHeader 'content-type'
    res.setHeader 'Content-Type', 'text/html; charset=utf-8'

  try
    # The view.get function renders and sets event listeners

    # The first chunk includes everything through header. Head should contain
    # any meta tags and script tags, since it is included before CSS.
    # If there is a small amount of header HTML that will display well by itself,
    # it is a good idea to add this to the Header view so that it renders ASAP.
    doctype = @get 'doctype', ns, ctx
    root = @get 'root', ns, ctx
    charset = @get 'charset', ns, ctx
    title = escapeHtml @get 'title$s', ns, ctx
    head = @get 'head', ns, ctx
    header = @get 'header', ns, ctx
    res.write "#{doctype}#{root}#{charset}<title>#{title}</title>#{head}#{@_css}#{header}"

    # Remaining HTML
    res.write @get('body', ns, ctx) + @get('footer', ns, ctx)

  catch err
    errText = templateError err
    @_errors ||= errorHtml Template: errText

  # Inline scripts and external scripts
  clientName = @_clientName
  scripts = "<script>function $(i){return document.getElementById(i)}" +
    escapeInlineScript(@_inline)
  scripts += "function #{clientName}(){#{clientName}=1}"  unless isStatic
  scripts += "</script>" + @get('scripts', ns, ctx)
  scripts += "<script defer async onload=#{clientName}() src=#{@_jsFile}></script>"  unless isStatic
  res.write scripts

  # Initialization script and Tail
  tail = @get 'tail', ns, ctx
  return res.end tail  if isStatic

  res.end "<script>(function(){function f(){setTimeout(function(){" +
    "#{clientName}=require('#{@_require}')(" +
    escapeInlineScript(bundle) + ",'#{@_appHash}','" + (ns || '') + "'," +
    (if ctx then escapeInlineScript(JSON.stringify ctx) else '0') +
    (if @_watch then ",'#{@_appFilename}'" else '' ) +
    ")},0)}#{clientName}===1?f():#{clientName}=f})()</script>#{tail}#{@_errors}"
