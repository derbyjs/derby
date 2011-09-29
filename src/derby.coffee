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

  createApp: (appModule, appExports) ->
    # Expose Racer and Derby methods on the application module
    racer.util.merge appExports, racer
    appExports.view = view = new View
    appExports.render = (res, model, ctx) -> view.render res, model, ctx
    appExports.ready = ->
    createStore = appExports.createStore
    store = null
    appExports.createStore = (options) -> store = createStore options
    appExports._setStore = (_store) -> store = _store

    routes = []
    appExports.get = (pattern, callback) -> routes.push [pattern, callback]
    appExports.router = ->
      router = new Router serverMock
      routes.forEach ([pattern, callback]) ->
        router._route 'get', pattern, (req, res, next) ->
          model = store.createModel()
          page = new Page view, res, model
          params = Object.create req.params
          params.url = req.url
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
