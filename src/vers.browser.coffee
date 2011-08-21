racer = require 'racer'
modelHelper = require './modelHelper'
Dom = require './Dom'
View = require './View'

exports.createApp = (appModule, appExports) ->
  # Expose racer's methods on the application module
  racer.util.merge appExports, racer

  appExports.view = view = new View
  dom = view.dom = new Dom(model = view.model = modelHelper.init racer.model)
  
  appModule.exports = (idCount, modelData, modelEvents, domEvents) ->
    view._idCount = idCount
    racer.init modelData
    model.__events.set modelEvents
    dom.init domEvents
    return appExports
  
  return appExports
