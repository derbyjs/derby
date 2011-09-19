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
    appExports.send = (res, model, ctx) -> view.send res, model, ctx
    appExports.ready = ->

    view._derbyOptions = @options
    view._appFilename = appModule.filename

    # Call send to trigger a compile as soon as the server starts
    empty = ->
    res =
      getHeader: empty
      setHeader: empty
      write: empty
      end: empty
    model =
      get: empty
      bundle: empty
    view.send res, model

    return appExports

