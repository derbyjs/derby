racer = require 'racer'
modelHelper = require './modelHelper'
Dom = require './Dom'
View = require './View'

exports.createApp = (appModule, appExports) ->
  # Expose Racer and Derby methods on the application module
  racer.util.merge appExports, racer
  appExports.view = view = new View
  
  appExports.ready = (fn) -> racer.onready = fn
 
  model = view.model = racer.model
  dom = view.dom = new Dom model, appExports
  modelHelper.init model, dom, view
  view.make name, template  for name, template of "{{templates}}"
  
  appModule.exports = (idCount, paths, partialIds, modelBundle, modelEvents, domEvents) ->
    view._idCount = idCount
    view._paths = paths
    view._partialIds = partialIds
    racer.init modelBundle
    model.__events.set modelEvents
    dom.init domEvents
    return appExports
  
  return appExports
