EventDispatcher = require './EventDispatcher'
PathMap = require './PathMap'

exports.init = (model, dom) ->
  pathMap = model.__pathMap = new PathMap

  if dom then eventOptions = 
    onBind: (name, listener) -> pathMap.id name
    onTrigger: (name, listener, value, type, local, options) ->
      [id, method, property] = listener
      partial = listener.fn
      path = pathMap.paths[name]

      method = 'prop'  if method is 'propPolite' && local

      if partial is '$inv'
        value = !value
      else if partial
        triggerId = id
        if method is 'html' && type
          # Handle array updates
          method = type
          if type is 'append'
            path += '.' + (index = model.get(path).length - 1)
            triggerId = null
          else if type is 'insert'
            [index, value] = value
            path += '.' + index
            triggerId = null
          else if type is 'remove'
            noRender = true
          else if type is 'move'
            noRender = true
            [value, property] = value
        unless noRender
          value = partial listener.ctx, model, path, triggerId, value, index, true
          value = ''  unless value?

      # Remove this listener if the DOM update fails
      # Happens when an id cannot be found
      return dom.update id, method, options && options.ignore, value, property, index

  events = model.__events = new EventDispatcher eventOptions
  return model unless dom

  model.on 'set', ([path, value], local, options) ->
    events.trigger pathMap.id(path), value, 'html', local, options

  model.on 'del', ([path], local, options) ->
    events.trigger pathMap.id(path), undefined, 'html', local, options

  model.on 'push', ([path, values...], local, options) ->
    id = pathMap.id path
    for value in values
      events.trigger id, value, 'append', local, options
    return

  model.on 'move', ([path, from, to], local, options) ->
    len = model.get(path).length
    from = refIndex from
    to = refIndex to
    from += len if from < 0
    to += len if to < 0
    return if from == to
    pathMap.onMove path, from, to  # Update indicies in pathMap
    events.trigger pathMap.id(path), [from, to], 'move', local, options

  model.on 'unshift', ([path, values...], local, options) ->
    insert events, pathMap, path, 0, values, local, options

  model.on 'insertBefore', ([path, index, value], local, options) ->
    insert events, pathMap, path, index, [value], local, options

  model.on 'insertAfter', ([path, index, value], local, options) ->
    insert events, pathMap, path, index + 1, [value], local, options

  model.on 'remove', ([path, start, howMany], local, options) ->
    remove events, pathMap, path, start, howMany, local, options

  model.on 'pop', ([path], local, options) ->
    remove events, pathMap, path, model.get(path).length, 1, local, options

  model.on 'shift', ([path], local, options) ->
    remove events, pathMap, path, 0, 1, local, options

  model.on 'splice', ([path, start, howMany, values...], local, options) ->
    remove events, pathMap, path, start, howMany, local, options
    insert events, pathMap, path, index, values, local, options

  for event in ['connected', 'canConnect']
    do (event) -> model.on event, (value) ->
      events.trigger pathMap.id(event), value

  return model


refIndex = (obj) ->
  # Get index if event was from arrayRef id object
  if typeof obj is 'object' then obj.index else +obj

insert = (events, pathMap, path, start, values, local, options) ->
  start = refIndex start
  pathMap.onInsert path, start, values.length  # Update indicies in pathMap
  id = pathMap.id path
  for value, i in values
    events.trigger id, [start + i, value], 'insert', local, options
  return

remove = (events, pathMap, path, start, howMany, local, options) ->
  start = refIndex start
  end = start + howMany
  pathMap.onRemove path, start, howMany  # Update indicies in pathMap
  id = pathMap.id path
  for index in [start...end]
    events.trigger id, index, 'remove', local, options
  return
