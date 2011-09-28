racer = require 'racer'
View = require './View.server'
loader = require './loader'
Router = require 'express/lib/router'

# The router middleware checks whether 'case sensitive routes' and 'strict routing'
# are enabled. For now, always use the default value of false
serverMock =
  enabled: -> false

module.exports =
  options: {}
  configure: (@options) ->

  createApp: (appModule, appExports) ->
    # Expose Racer and Derby methods on the application module
    racer.util.merge appExports, racer
    appExports.view = view = new View
    appExports.render = (res, model, ctx) -> view.render res, model, ctx
    appExports.ready = ->

    routes = []
    appExports.get = (pattern, callback) -> routes.push [pattern, callback]
    appExports.router = ->
      router = new Router serverMock
      router._route 'get', pattern, callback for [pattern, callback] in routes
      return router.middleware

    view._derbyOptions = @options
    view._appFilename = appModule.filename

    # Call render to trigger a compile as soon as the server starts
    view.render()

    return appExports
