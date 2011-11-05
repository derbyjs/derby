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
        if method is 'html' && type
          # Handle array updates
          method = type
          if type is 'append'
            oldPath += '.' + (model.get(path).length - 1)
          else if type is 'insert'
            [index, value] = value
            oldPath += '.' + index
          else if type is 'remove'
            noRender = true
          else if type is 'move'
            noRender = true
            [value, property] = value
        else if method is 'attr'
          value = null
        value = view.get partial, value, null, null, oldPath  unless noRender

      # Remove this listener if the DOM update fails. Happens when an id cannot be found
      return dom.update id, method, value, property, index


  model.on 'set', ([path, value], local) ->
    events.trigger path, value, 'html', local

  model.on 'del', ([path], local) ->
    events.trigger path, undefined, 'html', local

  model.on 'push', ([path, values...], local) ->
    for value in values
      events.trigger path, value, 'append', local
    return

  model.on 'move', ([path, from, to], local) ->
    events.trigger path, [from, to], 'move', local

  insert = (path, index, values, local) ->
    for value, i in values
      events.trigger path, [index + i, value], 'insert', local
    return

  remove = (path, start, howMany, local) ->
    for index in [start..start + howMany - 1]
      events.trigger path, index, 'remove', local
    return

  model.on 'unshift', ([path, values...], local) ->
    insert path, 0, values, local

  model.on 'insertBefore', ([path, index, value], local) ->
    insert path, index, [value], local

  model.on 'insertAfter', ([path, index, value], local) ->
    insert path, index + 1, [value], local

  model.on 'remove', ([path, start, howMany], local) ->
    remove path, start, howMany, local

  model.on 'pop', ([path], local) ->
    remove path, model.get(path).length, 1, local

  model.on 'shift', ([path], local) ->
    remove path, 0, 1, local

  model.on 'splice', ([path, start, howMany, values...], local) ->
    remove path, start, howMany, local
    insert path, index, values, local

  for event in ['connected', 'canConnect']
    do (event) -> model.on event, (value) ->
      events.trigger event, value

  return model
