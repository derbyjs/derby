EventDispatcher = require './EventDispatcher'
PathMap = require './PathMap'
{Model} = require('racer').protected

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
      isArray = pathMap.arrays[path] || Array.isArray(@get path)
      if isArray && last
        for child, i in node.childNodes
          if child == last
            path = path + '.' + i
            break
      return @__at path, absolute
    last = node
    node = node.parentNode

  # Just return the model if a path can't be found
  return this

exports.init = (model, dom, view) ->
  pathMap = model.__pathMap = new PathMap
  events = model.__events = new EventDispatcher
    onTrigger: (pathId, listener, type, local, options, value, index, arg) ->
      id = listener[0]
      # Fail and remove the listener if the element can't be found
      return false unless el = dom.item id

      method = listener[1]
      property = listener[2]
      partial = listener.partial
      path = pathMap.paths[pathId]

      method = 'prop' if method is 'propPolite' && local

      if partial
        triggerId = id
        if method is 'html' && type
          # Handle array updates
          method = type
          if type is 'append'
            path += '.' + (index = model.get(path).length - 1)
            triggerId = null
          else if type is 'insert'
            path += '.' + index
            triggerId = null
          else if type is 'remove'
            partial = null
          else if type is 'move'
            partial = null
            property = arg

      if listener.getValue
        value = listener.getValue model, path

      if partial
        value = partial listener.ctx, model, path, triggerId, value, index, listener
        return unless value?

      dom.update el, method, options && options.ignore, value, property, index
      return

  # Derby's mutator listeners are added via unshift instead of model.on, because
  # it needs to handle events in the same order that racer applies mutations.
  # If there is a listener to an event that applies a mutation, event listeners
  # later in the listeners queues could receive events in a different order

  model.listeners('set').unshift (args, out, local, pass) ->
    model.emit 'pre:set', args, out, local, pass
    [path, value] = args

    # For set operations on array items, also emit a remove and insert in case the
    # array is bound
    if /\.\d+$/.test path
      i = path.lastIndexOf('.')
      arrayPath = path[0...i]
      index = path.slice i + 1
      triggerEach events, pathMap, arrayPath, 'remove', local, pass, index
      triggerEach events, pathMap, arrayPath, 'insert', local, pass, value, index

    triggerEach events, pathMap, path, 'html', local, pass, value

  model.listeners('del').unshift (args, out, local, pass) ->
    model.emit 'pre:del', args, out, local, pass
    [path] = args
    triggerEach events, pathMap, path, 'html', local, pass

  model.listeners('push').unshift (args, out, local, pass) ->
    model.emit 'pre:push', args, out, local, pass
    [path, values...] = args
    for value in values
      triggerEach events, pathMap, path, 'append', local, pass, value
    return

  model.listeners('move').unshift (args, out, local, pass) ->
    model.emit 'pre:move', args, out, local, pass
    [path, from, to, howMany] = args
    len = model.get(path).length
    from = refIndex from
    to = refIndex to
    from += len if from < 0
    to += len if to < 0
    return if from == to
    pathMap.onMove path, from, to, howMany  # Update indicies in pathMap
    triggerEach events, pathMap, path, 'move', local, pass, from, howMany, to

  model.listeners('unshift').unshift (args, out, local, pass) ->
    model.emit 'pre:unshift', args, out, local, pass
    [path, values...] = args
    insert events, pathMap, path, 0, values, local, pass

  model.listeners('insert').unshift (args, out, local, pass) ->
    model.emit 'pre:insert', args, out, local, pass
    [path, index, values...] = args
    insert events, pathMap, path, index, values, local, pass

  model.listeners('remove').unshift (args, out, local, pass) ->
    model.emit 'pre:remove', args, out, local, pass
    [path, start, howMany] = args
    remove events, pathMap, path, start, howMany, local, pass

  model.listeners('pop').unshift (args, out, local, pass) ->
    model.emit 'pre:pop', args, out, local, pass
    [path] = args
    remove events, pathMap, path, model.get(path).length, 1, local, pass

  model.listeners('shift').unshift (args, out, local, pass) ->
    model.emit 'pre:shift', args, out, local, pass
    [path] = args
    remove events, pathMap, path, 0, 1, local, pass

  for event in ['connected', 'canConnect']
    do (event) -> model.listeners(event).unshift (value) ->
      triggerEach events, pathMap, event, null, true, null, value

  model.on 'reInit', ->
    view.history.refresh()

  return model

triggerEach = (events, pathMap, path, arg0, arg1, arg2, arg3, arg4, arg5) ->
  # Trigger an event on the path if it has a pathMap ID
  if id = pathMap.ids[path]
    events.trigger id, arg0, arg1, arg2, arg3, arg4, arg5

  # Also trigger a pattern event for the path and each of its parent paths
  # This is used by view helper functions to match updates on a path
  # or any of its child segments
  segments = path.split '.'
  i = segments.length + 1
  while --i
    pattern = segments.slice(0, i).join('.') + '*'
    if id = pathMap.ids[pattern]
      events.trigger id, arg0, arg1, arg2, arg3, arg4, arg5
  return

refIndex = (obj) ->
  # Get index if event was from arrayRef id object
  if typeof obj is 'object' then obj.index else +obj

insert = (events, pathMap, path, start, values, local, pass) ->
  start = refIndex start
  pathMap.onInsert path, start, values.length  # Update indicies in pathMap
  for value, i in values
    triggerEach events, pathMap, path, 'insert', local, pass, value, start + i
  return

remove = (events, pathMap, path, start, howMany, local, pass) ->
  start = refIndex start
  end = start + howMany
  pathMap.onRemove path, start, howMany  # Update indicies in pathMap
  for index in [start...end]
    triggerEach events, pathMap, path, 'remove', local, pass, start
  return
