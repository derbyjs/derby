EventDispatcher = require './EventDispatcher'

exports.init = (model, dom, view) ->
  get = model.get

  events = model.__events = new EventDispatcher
    onTrigger: (path, listener, value, type, local) ->
      [oldPath, id, method, property, partial] = listener
      
      # Check to see if this event is triggering for the right object. Remove
      # this listener if it is now stale
      return false  unless oldPath == path || get(oldPath) == get(path)
     
      if partial is '$inv'
        value = !value
      else if partial
        value = view.get partial, value
      # Remove this listener if the DOM update fails. This usually happens
      # when an id cannot be found
      return dom.update id, method, property, value, type, local

    onBind: (path, listener) ->
      # Save the original path in the listener to be checked at trigger time
      listener.unshift path
  
  # Don't subscribe to any events on the server
  return model  unless dom
  
  for event in ['set', 'push']
    do (event) -> model.on event, ([path, value], local) ->
      events.trigger path, value, event, local

  for event in ['connected', 'canConnect']
    do (event) -> model.on event, (value) ->
      events.trigger event, value
  
  return model
