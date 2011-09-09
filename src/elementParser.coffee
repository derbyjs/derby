# TODO: Include this from View. Wasn't working with require for some reason
modelPath = (data, name) ->
  if (path = data.$path) && name.charAt(0) == '.'
    return if name is '.' then path else path + name
  return null  unless (datum = data[name]) && path = datum.model
  path.replace /\(([^)]+)\)/g, (match, name) -> data[name]

module.exports = ->
  addDomEvent: addDomEvent = (events, attrs, name, eventNames, getMethod, property, invert) ->
    args = [null, null, getMethod, property]
    if isArray = Array.isArray eventNames
      for eventName, i in eventNames
        eventNames[i] = eventName.split ','
    else
      [eventName, delay] = eventNames.split ','
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
          eventNames = ['keyup', 'keydown', 'paste,0', 'dragover,0']
        
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

  parseElement:
    'select': (events, attrs) ->
      console.log 'hey'
      distribute events, attrs, 'change'
      return addId: true

  parseAttr:
    'x-bind':
      '*': (events, attrs, name, fn) ->
        delete attrs['x-bind']
        [name, delay] = name.split ','
        args = [fn, null]
        args.push delay  if delay?
        events.push (data, modelEvents, domEvents) ->
          args[1] = attrs._id || attrs.id
          domEvents.bind name, args
        return addId: true
      a: (events, attrs, name) ->
        if name is 'click' && !('href' of attrs)
          attrs.href = '#'
          attrs.onclick = 'return false'  unless 'onclick' of attrs
      form: (events, attrs, name) ->
        if name is 'submit'
          attrs.onsubmit = 'return false'  unless 'onsubmit' of attrs

