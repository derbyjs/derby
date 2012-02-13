racer = require 'racer'
View = require './View.server'
files = require './files'
Router = require 'express/lib/router'
fs = require 'fs'

isProduction = racer.util.isProduction

# The router middleware checks whether 'case sensitive routes' and 'strict routing'
# are enabled. For now, always use the default value of false
serverMock =
  enabled: -> false

Page = (@view, @res, @model) -> return
Page:: =
  render: (ctx, status) ->
    @view.render @res, @model, ctx, status
  redirect: (url, status) ->
    @res.redirect url, status

Static = (@root) ->
  @views = {}
  return
Static:: =
  render: (name, res, model, ctx, status) ->
    unless view = @views[name]
      view = @views[name] = new View
      view._root = @root
      view._clientName = name
    view.render res, model, ctx, status, true

addWatches = (appFilename, options, sockets) ->
  {root, clientName} = files.parseName appFilename, options

  files.watch root, 'css', ->
    files.css root, clientName, (css) ->
      for socket in sockets
        socket.emit 'refreshCss', css

  files.watch root, 'html', ->
    files.templates root, clientName, (templates) ->
      for socket in sockets
        socket.emit 'refreshHtml', templates

autoRefresh = (store, options) ->
  return if isProduction || store._derbySocketsSetup
  store._derbySocketsSetup = true
  listeners = {}
  store.sockets.on 'connection', (socket) ->
    socket.on 'derbyClient', (appFilename) ->
      return unless appFilename

      if listeners[appFilename]
        return listeners[appFilename].push socket

      sockets = listeners[appFilename] = [socket]
      addWatches appFilename, options, sockets

derby = module.exports =
  options: {}
  configure: (@options) ->

  createApp: (appModule) ->
    appExports = appModule.exports
    # Expose methods on the application module
    appExports.view = view = new View
    appExports.render = (res, model, ctx, status) -> view.render res, model, ctx, status
    appExports.ready = ->

    view._derbyOptions = options = @options
    view._appFilename = appModule.filename

    store = null
    session = null
    appExports._setStore = setStore = (_store) ->
      autoRefresh _store, options
      session?._setStore _store
      return store = _store
    appExports.createStore = (options) -> setStore racer.createStore options
    appExports.session = -> session = racer.session store

    routes = []
    ['get', 'post', 'put', 'del'].forEach (method) ->
      appExports[method] = (pattern, callback) ->
        routes.push [method, pattern, callback]
    appExports.router = ->
      router = new Router serverMock
      routes.forEach ([method, pattern, callback]) ->
        router._route method, pattern, (req, res, next) ->
          model = req.model || store.createModel()
          page = new Page view, res, model
          {url, body, query} = req
          params = {url, body, query}
          params[k] = v for k, v of req.params
          callback page, model, params, next
      return router.middleware

    # Call render to trigger a compile as soon as the server starts
    view.render()

    return appExports

  createStatic: (root) ->
    return new Static root

  createStore: (args...) ->
    last = args[args.length - 1]
    # Check to see if last argument is a createStore options object
    options = args.pop()  unless last.view
    store = racer.createStore options
    app._setStore store  for app in args
    return store
  
  session: racer.session

Object.defineProperty derby, 'version',
  get: -> JSON.parse(fs.readFileSync __dirname + '/../package.json', 'utf8').version
