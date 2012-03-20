EventDispatcher = require './EventDispatcher'
PathMap = require './PathMap'
{Model} = require 'racer'

# Add support for creating a model alias from a DOM node or jQuery object
Model::__at = Model::at
Model::at = (node, absolute) ->
  unless node && (node.parentNode || node.jquery && (node = node[0]))
    return @__at node, absolute

  # NodeFilter.SHOW_COMMENT == 128
  commentIterator = document.createTreeWalker document.body, 128, null, false
  while comment = commentIterator.nextNode()
    continue if comment.$derbyChecked
    comment.$derbyChecked = true
    id = comment.data
    continue unless id.charAt(0) == '$'
    if id.charAt(1) == '$'
      comment.$derbyMarkerEnd = true
      id = id[1..]
    comment.$derbyMarkerId = id
    comment.parentNode.$derbyMarkerParent = true

  blockPaths = @__blockPaths
  pathMap = @__pathMap
  while node

    if node.$derbyMarkerParent
      node = last
      while node = node.previousSibling
        continue unless id = node.$derbyMarkerId
        break if node.$derbyMarkerEnd
        break unless pathId = blockPaths[id]
        path = pathMap.paths[pathId]
        if pathMap.arrays[path] && last
          i = 0
          while node = node.nextSibling
            if node == last
              path = path + '.' + i
              break
            i++
        return @__at path, absolute

      last = last.parentNode
      node = last.parentNode
      continue

    if (id = node.id) && (pathId = blockPaths[id])
      path = pathMap.paths[pathId]
      if pathMap.arrays[path] && last
        for child, i in node.childNodes
          if child == last
            path = path + '.' + i
            break
      return @__at path, absolute
    last = node
    node = node.parentNode

  # Just return the model if a path can't be found
  return this

exports.init = (model, dom) ->
  pathMap = model.__pathMap = new PathMap
  events = model.__events = new EventDispatcher
    onTrigger: (name, listener, value, type, local, options) ->
      id = listener[0]
      # Fail and remove the listener if the element can't be found
      return false unless el = dom.item id

      method = listener[1]
      property = listener[2]
      partial = listener.fn
      path = pathMap.paths[name]

      method = 'prop' if method is 'propPolite' && local

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
            [value, property, index] = value
        unless noRender
          value = partial listener.ctx, model, path, triggerId, value, index, true
          value = '' unless value?

      # Remove this listener if the DOM update fails
      # Happens when an id cannot be found
      dom.update el, method, options && options.ignore, value, property, index

  # Derby's mutator listeners are added via unshift instead of model.on, because
  # it needs to handle events in the same order that racer applies mutations.
  # If there is a listener to an event that applies a mutation, event listeners
  # later in the listeners queues could receive events in a different order

  model.listeners('set').unshift (args, out, local, options) ->
    model.emit 'pre:set', args, out, local, options
    [path, value] = args

    # For set operations on array items, also emit a remove and insert in case the
    # array is bound
    if /\.\d+$/.test path
      i = path.lastIndexOf('.')
      arrayPath = path[0...i]
      index = path.slice i + 1
      events.trigger pathMap.id(arrayPath), index, 'remove', local, options
      events.trigger pathMap.id(arrayPath), [index, value], 'insert', local, options

    events.trigger pathMap.id(path), value, 'html', local, options

  model.listeners('del').unshift (args, out, local, options) ->
    model.emit 'pre:del', args, out, local, options
    [path] = args
    events.trigger pathMap.id(path), undefined, 'html', local, options

  model.listeners('push').unshift (args, out, local, options) ->
    model.emit 'pre:push', args, out, local, options
    [path, values...] = args
    id = pathMap.id path
    for value in values
      events.trigger id, value, 'append', local, options
    return

  model.listeners('move').unshift (args, out, local, options) ->
    model.emit 'pre:move', args, out, local, options
    [path, from, to, howMany] = args
    len = model.get(path).length
    from = refIndex from
    to = refIndex to
    from += len if from < 0
    to += len if to < 0
    return if from == to
    pathMap.onMove path, from, to, howMany  # Update indicies in pathMap
    events.trigger pathMap.id(path), [from, to, howMany], 'move', local, options

  model.listeners('unshift').unshift (args, out, local, options) ->
    model.emit 'pre:unshift', args, out, local, options
    [path, values...] = args
    insert events, pathMap, path, 0, values, local, options

  model.listeners('insert').unshift (args, out, local, options) ->
    model.emit 'pre:insert', args, out, local, options
    [path, index, values...] = args
    insert events, pathMap, path, index, values, local, options

  model.listeners('remove').unshift (args, out, local, options) ->
    model.emit 'pre:remove', args, out, local, options
    [path, start, howMany] = args
    remove events, pathMap, path, start, howMany, local, options

  model.listeners('pop').unshift (args, out, local, options) ->
    model.emit 'pre:pop', args, out, local, options
    [path] = args
    remove events, pathMap, path, model.get(path).length, 1, local, options

  model.listeners('shift').unshift (args, out, local, options) ->
    model.emit 'pre:shift', args, out, local, options
    [path] = args
    remove events, pathMap, path, 0, 1, local, options

  for event in ['connected', 'canConnect']
    do (event) -> model.listeners(event).unshift (value) ->
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
