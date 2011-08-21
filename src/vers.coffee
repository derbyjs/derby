racer = require 'racer'
View = require './View.server'
path = require 'path'

exports.createApp = (appModule, appExports) ->
  # Expose racer's methods on the application module
  racer.util.merge appExports, racer

  appExports.view = view = new View
  view._clientName = path.basename appModule.filename, '.js'
  clientDir = path.dirname appModule.filename
  view._jsFile = ''

  return appExports

