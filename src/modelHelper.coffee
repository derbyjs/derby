EventDispatcher = require './EventDispatcher'

exports.init = (model) ->
  model.__events = new EventDispatcher

  return model
