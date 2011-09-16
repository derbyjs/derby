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

    loader.js appModule.filename, @options, ({root, clientName, jsFile, require}) ->
      view._root = root
      view._clientName = clientName
      view._jsFile = jsFile
      view._require = require
      view._load()

    return appExports

