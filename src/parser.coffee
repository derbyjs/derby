replaceIndex = (ctx, path, noReplace) ->
  return path  if noReplace || !(indices = ctx.$i) || !path
  i = 0
  path.replace /\$#/g, -> indices[i++]

addConditionalStyle = (attrs, name, invert, styleText) ->
  type = if invert then '#' else '^'
  cat = "{{#{type}#{name}}}#{styleText}{{/}}"
  attrs.style = if style = attrs.style then "#{style};#{cat}" else cat

splitBind = (value) ->
  pairs = value.replace(/\s/g, '').split ','
  out = {}
  for pair in pairs
    [name, value] = pair.split ':'
    [name, delay] = name.split '/'
    out[name] = {value, delay}
  return out

unaliasName = (ctx, name) ->
  return name  unless name.charAt(0) is ':'
  i = name.indexOf '.'
  aliasName = name.substring 1, i
  remainder = name.substr i + 1
  # Calculate depth difference between alias's definition and usage
  offset = ctx.$depth - ctx.$aliases[aliasName]
  if offset != offset  # If NaN
    throw new Error "Can't find alias for #{name}"
  # Convert depth difference to a relative model path
  return Array(offset + 1).join('.') + remainder

module.exports =
  modelPath: modelPath = (ctx, name, noReplace) ->
    return null  if name of ctx
    name = unaliasName ctx, name
    if name.charAt(0) == '.' && paths = ctx.$paths
      return replaceIndex(ctx, paths[0], noReplace)  if name is '.'
      i = /^\.+/.exec(name)[0].length - 1
      return replaceIndex(ctx, paths[i], noReplace) + name.substr(i)
    name.replace /\[([^\]]+)\]/g, (match, name) -> ctx[name]

  addDomEvent: addDomEvent = (events, attrs, name, _eventNames, getMethod, property, invert) ->
    if isArray = Array.isArray _eventNames
      eventNames = []
      for eventName, i in _eventNames
        eventNames[i] = eventName.split '/'
    else
      [eventName, delay] = _eventNames.split '/'
    events.push (ctx, modelEvents, domEvents) ->
      path = modelPath ctx, name
      id = attrs._id || attrs.id
      if isArray
        for [eventName, delay] in eventNames
          domEvents.bind eventName,
            [path, id, getMethod, property, delay, invert]
      else
        domEvents.bind eventName,
          [path, id, getMethod, property, delay, invert]
      return

  distribute: distribute = (events, attrs, eventName) ->
    events.push (ctx, modelEvents, domEvents) ->
      domEvents.bind eventName, ['$dist', attrs._id || attrs.id]

  parsePlaceholder:
    'value':
      input: (events, attrs, name) ->
        if 'x-blur' of attrs
          # Only update after the element loses focus
          delete attrs['x-blur']
          eventNames = 'change'
        else
          # By default, update as the user types
          eventNames = 'input'
        
        addDomEvent events, attrs, name, eventNames, 'prop', 'value'
        # Update the element's property unless it has focus
        return method: 'propPolite'
    
    'checked':
      '*': (events, attrs, name, invert) ->
        addDomEvent events, attrs, name, 'change', 'prop', 'checked', invert
        return method: 'prop', bool: true
    
    'selected':
      '*': (events, attrs, name, invert) ->
        addDomEvent events, attrs, name, 'change', 'prop', 'selected', invert
        return method: 'prop', bool: true
    
    'disabled':
      '*': -> return method: 'prop', bool: true

    'x-visible':
      '*': (events, attrs, name, invert) ->
        addConditionalStyle attrs, name, invert, 'visibility:hidden'
        return method: 'visible', del: true

    'x-displayed':
      '*': (events, attrs, name, invert) ->
        addConditionalStyle attrs, name, invert, 'display:none'
        return method: 'displayed', del: true

  parseElement:
    'select': (events, attrs) ->
      distribute events, attrs, 'change'
      return addId: true

  parseAttr:
    'x-bind':
      '*': (events, attrs, value) ->
        delete attrs['x-bind']
        for name, obj of splitBind value
          {value, delay} = obj
          do (name, value, delay) ->
            events.push (ctx, modelEvents, domEvents) ->
              domEvents.bind name, [value, attrs._id || attrs.id, delay]
        return addId: true
      a: (events, attrs, value) ->
        obj = splitBind value
        if 'click' of obj && !('href' of attrs)
          attrs.href = '#'
          attrs.onclick = 'return false'  unless 'onclick' of attrs
      form: (events, attrs, value) ->
        obj = splitBind value
        if 'submit' of obj
          attrs.onsubmit = 'return false'  unless 'onsubmit' of attrs
