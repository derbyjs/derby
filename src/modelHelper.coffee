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

      method = 'prop'  if method is 'propPolite' && local

      if partial is '$inv'
        value = !value
      else if partial
        if method is 'html'
          # Handle array updates
          if type
            method = type
            if type is 'append'
              oldPath += '.' + (model.get(path).length - 1)
            else if type is 'insert'
              [value, index] = value
              oldPath += '.' + index
            else if type is 'remove'
              noRender = true
            else if type is 'move'
              noRender = true
              [value, property] = value
        value = view.get partial, value, null, null, oldPath  unless noRender

      # Remove this listener if the DOM update fails. Happens when an id cannot be found
      return dom.update id, method, value, property, index


  model.on 'set', ([path, value], local) ->
    events.trigger path, value, 'html', local

  model.on 'del', ([path], local) ->
    events.trigger path, undefined, 'html', local
  
  model.on 'push', ([path, vals...], local) ->
    events.trigger path, value, 'append', local  for value in vals

  model.on 'unshift', ([path, vals...], local) ->
    events.trigger path, [value, 0], 'insert', local  for value in vals.reverse()

  model.on 'insertBefore', ([path, index, value], local) ->
    events.trigger path, [value, index], 'insert', local
  
  model.on 'insertAfter', ([path, index, value], local) ->
    events.trigger path, [value, index + 1], 'insert', local
  
  model.on 'splice', ([path, start, howMany, vals...], local) ->
    events.trigger path, index, 'remove', local  for index in [start..start + howMany]
    events.trigger path, [value, index], 'insert', local  for value in vals
  
  model.on 'remove', ([path, start, howMany], local) ->
    events.trigger path, index, 'remove', local  for index in [start..start + howMany]

  model.on 'pop', ([path], local) ->
    index = model.get(path).length
    events.trigger path, index, 'remove', local

  model.on 'shift', ([path], local) ->
    events.trigger path, 0, 'remove', local

  model.on 'move', ([path, from, to], local) ->
    events.trigger path, [from, to], 'move', local
    
  for event in ['connected', 'canConnect']
    do (event) -> model.on event, (value) ->
      events.trigger event, value

  return model
