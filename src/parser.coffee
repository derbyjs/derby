replaceIndex = (data, path, noReplace) ->
  return path  if noReplace || !(indicies = data.$i) || !path
  i = 0
  path.replace /\$#/g, -> indicies[i++]

addConditionalStyle = (attrs, name, invert, styleText) ->
  type = if invert then '#' else '^'
  cat = "{{#{type}#{name}}}#{styleText}{{/}}"
  attrs.style = if style = attrs.style then "#{style};#{cat}" else cat

module.exports =
  modelPath: modelPath = (data, name, noReplace) ->
    if (paths = data.$paths) && name.charAt(0) == '.'
      return replaceIndex(data, paths[0], noReplace)  if name is '.'
      i = /^\.+/.exec(name)[0].length - 1
      return replaceIndex(data, paths[i], noReplace) + name.substr(i)
    return null  unless (datum = data[name]) && path = datum.model
    path.replace /\[([^\]]+)\]/g, (match, name) -> data[name]

  addDomEvent: addDomEvent = (events, attrs, name, _eventNames, getMethod, property, invert) ->
    args = [null, null, getMethod, property]
    if isArray = Array.isArray _eventNames
      eventNames = []
      for eventName, i in _eventNames
        eventNames[i] = eventName.split ','
    else
      [eventName, delay] = _eventNames.split ','
      args.push delay  if delay?
    prefix = if invert then '!' else ''
    events.push (data, modelEvents, domEvents) ->
      args[0] = prefix + modelPath data, name
      args[1] = attrs._id || attrs.id
      return domEvents.bind eventName, args  unless isArray
      for [eventName, delay] in eventNames
        domEvents.bind eventName, if delay? then args.concat delay else args

  distribute: distribute = (events, attrs, eventName) ->
    args = ['$dist', null]
    events.push (data, modelEvents, domEvents) ->
      args[1] = attrs._id || attrs.id
      domEvents.bind eventName, args

  textEvents: textEvents = ['keyup', 'keydown', 'paste,0', 'dragover,0']

  parsePlaceholder:
    'value':
      input: (events, attrs, name) ->
        if 'x-blur' of attrs
          # Only update after the element loses focus
          delete attrs['x-blur']
          eventNames = 'change'
        else
          # By default, update on any event that could change the value
          # Note that paste and dragover are emitted after a setTimeout, since
          # these events are fired before the input value is updated
          eventNames = textEvents
        
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
        [name, fn] = value.replace(/\s/g, '').split ':'
        [name, delay] = name.split ','
        args = [fn, null]
        args.push delay  if delay?
        events.push (data, modelEvents, domEvents) ->
          args[1] = attrs._id || attrs.id
          domEvents.bind name, args
        return addId: true
      a: (events, attrs, value) ->
        name = value.replace(/\s/g, '').split(':')[0]
        if name is 'click' && !('href' of attrs)
          attrs.href = '#'
          attrs.onclick = 'return false'  unless 'onclick' of attrs
      form: (events, attrs, value) ->
        name = value.replace(/\s/g, '').split(':')[0]
        if name is 'submit'
          attrs.onsubmit = 'return false'  unless 'onsubmit' of attrs

