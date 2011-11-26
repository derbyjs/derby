EventDispatcher = require './EventDispatcher'

# Keeps track of each unique path via an ID
PathMap = ->
  @count = 0
  @ids = {}
  @paths = {}
  @arrays = {}
  return

PathMap:: =

  id: (path) ->
    # Return the path for an id, or create a new id and index it
    this.ids[path] || (
      this.paths[id = ++@count] = path
      @indexArray path, id
      this.ids[path] = id
    )

  indexArray: (path, id) ->
    # TODO: Nested arrays
    if match = /^(.+)\.(\d+)(\..+|$)/.exec path
      name = match[1]
      index = +match[2]
      remainder = match[3]
      arr = @arrays[name] || @arrays[name] = []
      set = arr[index] || arr[index] = {}
      set[id] = remainder

  init: (@count, @ids) ->
    paths = @paths
    for path, id of @ids
      paths[id] = path
      @indexArray path, id


exports.init = (model, dom, view) ->
  pathMap = model.__pathMap = new PathMap

  if dom then events = model.__events = new EventDispatcher
    onTrigger: (name, listener, value, type, local, options) ->
      [id, method, property, partial] = listener
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
            path += '.' + (model.get(path).length - 1)
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
        else if method is 'attr'
          value = null
        value = view.get partial, value, null, null, path, triggerId  unless noRender

      # Remove this listener if the DOM update fails. Happens when an id cannot be found
      return dom.update id, method, options && options.ignore, value, property, index
  
  else events = model.__events = new EventDispatcher

  events.__bind = events.bind
  events.bind = (name, listener) ->
    events.__bind pathMap.id(name), listener

  return model unless dom

  # TODO: Add ignore option support to all event handlers
  # It's only supported with move right now

  model.on 'set', ([path, value], local) ->
    events.trigger pathMap.id(path), value, 'html', local

  model.on 'del', ([path], local) ->
    events.trigger pathMap.id(path), undefined, 'html', local

  model.on 'push', ([path, values...], local) ->
    id = pathMap.id path
    for value in values
      events.trigger id, value, 'append', local
    return

  refIndex = (obj) ->
    # Get index if event was from arrayRef id object
    if typeof obj is 'object' then obj.index else +obj

  incrementMapItems = (path, map, start, end, byNum) ->
    for i in [start..end]
      continue unless ids = map[i]
      for id, remainder of ids
        itemPath = path + '.' + (i + byNum) + remainder
        pathMap.paths[id] = itemPath
        pathMap.ids[itemPath] = +id
  
  deleteMapItems = (map, start, end, last) ->
    for i in [start..last]
      continue unless ids = map[i]
      for id of ids
        itemPath = pathMap.paths[id]
        delete pathMap.ids[itemPath]
        continue if i >= end
        delete pathMap.paths[id]

  model.on 'move', ([path, from, to, options], local) ->
    len = model.get(path).length
    from = refIndex from
    to = refIndex to
    from += len if from < 0
    to += len if to < 0
    return if from == to

    # Update indicies in pathMap before moving
    if map = pathMap.arrays[path]
      # Adjust paths for the moved item
      incrementMapItems path, map, from, from, to - from
      # Adjust paths for items between from and to
      if from > to
        incrementMapItems path, map, to, from - 1, 1
      else
        incrementMapItems path, map, from + 1, to, -1
      # Fix the array index
      [item] = map.splice from, 1
      map.splice to, 0, item

    events.trigger pathMap.id(path), [from, to], 'move', local, options

  insert = (path, start, values, local) ->
    start = refIndex start

    # Update indicies in pathMap before inserting
    if map = pathMap.arrays[path]
      howMany = values.length
      end = start + howMany
      last = map.length - 1
      # Delete indicies for items in inserted positions
      deleteMapItems map, start, end, last
      # Increment indicies of later items
      incrementMapItems path, map, start, last, howMany
      map.splice start, 0, {}  while howMany--

    id = pathMap.id path
    for value, i in values
      events.trigger id, [start + i, value], 'insert', local
    return

  remove = (path, start, howMany, local) ->
    start = refIndex start
    end = start + howMany

    # Update indicies in pathMap before removing
    if map = pathMap.arrays[path]
      last = map.length - 1
      # Delete indicies for removed items
      deleteMapItems map, start, end, last
      # Decrement indicies of later items
      incrementMapItems path, map, end, last, -howMany
      map.splice start, howMany

    id = pathMap.id path
    for index in [start...end]
      events.trigger id, index, 'remove', local
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
      events.trigger pathMap.id(event), value

  return model
