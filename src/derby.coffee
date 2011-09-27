racer = require 'racer'
View = require './View.server'
loader = require './loader'

module.exports =
  options: {}
  configure: (@options) ->

  createApp: (appModule, appExports) ->
    # Expose Racer and Derby methods on the application module
    racer.util.merge appExports, racer
    appExports.view = view = new View
    appExports.render = (res, model, ctx) -> view.render res, model, ctx
    appExports.ready = ->

    view._derbyOptions = @options
    view._appFilename = appModule.filename

    # Call render to trigger a compile as soon as the server starts
    view.render()

    return appExports

