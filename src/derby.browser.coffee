racer = require 'racer'
modelHelper = require './modelHelper'
Dom = require './Dom'
View = require './View'

exports.createApp = (appModule, appExports) ->
  # Expose Racer and Derby methods on the application module
  racer.util.merge appExports, racer
  appExports.view = view = new View
  
  dom = view.dom = new Dom(model = view.model = racer.model)
  modelHelper.init model, dom, view
  
  appModule.exports = (idCount, modelBundle, modelEvents, domEvents) ->
    view._idCount = idCount
    racer.init modelBundle
    model.__events.set modelEvents
    dom.init domEvents
    return appExports
  
  return appExports
