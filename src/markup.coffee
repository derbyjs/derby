module.exports =

  bound:
    'value':
      input: (events, attrs, name) ->
        if 'x-blur' of attrs
          # Only update after the element loses focus
          delete attrs['x-blur']
          eventNames = 'change,blur'
        else
          # By default, update as the user types
          eventNames = 'input,blur'
        
        if 'x-ignore-focus' of attrs
          # Update value regardless of focus
          delete attrs['x-ignore-focus']
          method = 'prop'
        else
          # Update value unless window and element are focused
          method = 'propPolite'
        
        addDomEvent events, attrs, name, eventNames, 'prop', 'value'
        # Update the element's property unless it has focus
        return {method}
    
    'checked':
      '*': (events, attrs, name, invert) ->
        addDomEvent events, attrs, name, 'change', 'prop', 'checked', invert
        return method: 'prop', bool: true
    
    'selected':
      '*': (events, attrs, name, invert) ->
        addDomEvent events, attrs, name, 'change', 'prop', 'selected', invert
        return method: 'prop', bool: true
    
    'disabled':
      '*': ->
        return method: 'prop', bool: true

    'x-visible':
      '*': (events, attrs, name, invert) ->
        addConditionalStyle attrs, name, invert, 'visibility:hidden'
        return method: 'visible', del: true

    'x-displayed':
      '*': (events, attrs, name, invert) ->
        addConditionalStyle attrs, name, invert, 'display:none'
        return method: 'displayed', del: true

  boundParent:
    'contenteditable':
      '*': (events, attrs, name) ->
        addDomEvent events, attrs, name, 'input,blur', 'html'
        return

  element:
    'select': (events, attrs) ->
      addDistribute events, attrs, 'change'
      return addId: true

  attr:
    'x-bind':
      '*': (events, attrs, value) ->
        for name, obj of splitBind value
          {value, delay} = obj
          do (name, value, delay) ->
            events.push (ctx, modelEvents, domEvents) ->
              domEvents.bind name, [value, attrs._id || attrs.id, delay]
        return addId: true, del: true
      
      a: (events, attrs, value) ->
        obj = splitBind value
        if 'click' of obj && !('href' of attrs)
          attrs.href = '#'
          attrs.onclick = 'return false'  unless 'onclick' of attrs
        return
      
      form: (events, attrs, value) ->
        obj = splitBind value
        if 'submit' of obj
          attrs.onsubmit = 'return false'  unless 'onsubmit' of attrs
        return

  modelPath: modelPath = (ctx, name, noReplace) ->
    return null  if name of ctx
    firstChar = name.charAt(0)

    if firstChar is ':'
      # Dereference alias name
      if ~(i = name.indexOf '.')
        aliasName = name.substring 1, i
        name = name.substr i
      else
        aliasName = name.substr 1
        name = ''
      # Calculate depth difference between alias's definition and usage
      i = ctx.$depth - ctx.$aliases[aliasName]
      if i != i  # If NaN
        throw new Error "Can't find alias for #{aliasName}"

    else if firstChar is '.'
      # Dereference relative path
      i = 0
      i++ while name.charAt(i) == '.'
      name = if i == name.length then '' else name.substr(i - 1)

    if i && (name = ctx.$paths[i - 1] + name) && !noReplace
      # Replace array index placeholders with the proper index
      i = 0
      indices = ctx.$i
      name = name.replace /\$#/g, -> indices[i++]

    # Interpolate the value of names within square brackets
    return name.replace /\[([^\]]+)\]/g, (match, name) -> ctx[name]


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

addDomEvent = (events, attrs, name, eventNames, getMethod, property, invert) ->
  eventNames = splitBind eventNames
  events.push (ctx, modelEvents, domEvents) ->
    path = modelPath ctx, name
    id = attrs._id || attrs.id
    for eventName, {delay} of eventNames
      domEvents.bind eventName, [path, id, getMethod, property, delay, invert]
    return

addDistribute = (events, attrs, eventName) ->
  events.push (ctx, modelEvents, domEvents) ->
    domEvents.bind eventName, ['$dist', attrs._id || attrs.id]
