EventDispatcher = require './EventDispatcher'

exports.init = (model, dom, view) ->
  # Save the original path in the listener to be checked at trigger time
  onBind = (path, listener) -> listener.unshift path

  unless dom
    model.__events = new EventDispatcher {onBind} 
    return model

  events = model.__events = new EventDispatcher
    onBind: onBind
    onTrigger: (path, listener, value, type, local) ->
      [oldPath, id, method, property, partial] = listener
      
      # Check to see if this event is triggering for the right object. Remove
      # this listener if it is now stale
      return false  unless oldPath == path || model.get(oldPath) == model.get(path)
     
      if partial is '$inv'
        value = !value
      else if partial
        # Append index of pushed element
        oldPath += '.' + (model.get(path).length - 1)  if type is 'push'
        value = view.get partial, value, null, null, oldPath
      # Remove this listener if the DOM update fails. This usually happens
      # when an id cannot be found
      return dom.update id, method, property, value, type, local
    
  for event in ['set', 'push']
    do (event) -> model.on event, ([path, value], local) ->
      events.trigger path, value, event, local

  for event in ['connected', 'canConnect']
    do (event) -> model.on event, (value) ->
      events.trigger event, value

  return model
