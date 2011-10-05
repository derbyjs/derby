racer = require 'racer'
View = require './View.server'
loader = require './loader'
Router = require 'express/lib/router'

# The router middleware checks whether 'case sensitive routes' and 'strict routing'
# are enabled. For now, always use the default value of false
serverMock =
  enabled: -> false

Page = (@view, @res, @model) -> return
Page:: =
  render: (ctx) ->
    @view.render @res, @model, ctx
  redirect: (url, status) ->
    @res.redirect url, status

module.exports =
  options: {}
  configure: (@options) ->

  createApp: (appModule) ->
    appExports = appModule.exports
    # Expose Racer and Derby methods on the application module
    racer.util.merge appExports, racer
    appExports.view = view = new View
    appExports.render = (res, model, ctx) -> view.render res, model, ctx
    appExports.ready = ->
    
    store = null
    session = null
    appExports._setStore = setStore = (_store) ->
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
          params = {url, body, query} = req
          params[k] = v for k, v of req.params
          callback page, model, params, next
      return router.middleware

    view._derbyOptions = @options
    view._appFilename = appModule.filename

    # Call render to trigger a compile as soon as the server starts
    view.render()

    return appExports
  
  createStore: (args...) ->
    last = args[args.length - 1]
    # Check to see if last argument is a createStore options object
    options = args.pop()  unless last.view
    store = racer.createStore options
    app._setStore store  for app in args
    return store
  
  session: racer.session
