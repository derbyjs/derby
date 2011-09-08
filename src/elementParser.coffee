# TODO: Include this from View. Wasn't working with require for some reason
modelPath = (data, name) ->
  return path + name  if (path = data.$path) && name.charAt(0) == '.'
  return null  unless (datum = data[name]) && path = datum.model
  path.replace /\(([^)]+)\)/g, (match, name) -> data[name]

module.exports = ->
  addDomEvent: addDomEvent = (events, attrs, name, eventNames, onMethod, getMethod, property) ->
    args = [onMethod, null, null, getMethod, property]
    if isArray = Array.isArray eventNames
      for eventName, i in eventNames
        eventNames[i] = eventName.split ','
    else
      [eventName, delay] = eventNames.split ','
      args.push delay  if delay?
    events.push (data, modelEvents, domEvents) ->
      args[1] = modelPath data, name
      args[2] = attrs._id || attrs.id
      return domEvents.bind eventName, args  unless isArray
      for [eventName, delay] in eventNames
        domEvents.bind eventName, if delay? then args.concat delay else args

  parsePlaceholder:
    'value':
      input: (events, attr, attrs, name) ->
        if 'x-blur' of attrs
          # Only update after the element loses focus
          delete attrs['x-blur']
          eventNames = 'change'
        else
          # By default, update on any event that could change the value
          # Note that paste and dragover are emitted after a setTimeout, since
          # these events are fired before the input value is updated
          eventNames = ['keyup', 'keydown', 'paste,0', 'dragover,0']
        
        addDomEvent events, attrs, name, eventNames, 'set', 'prop', 'value'
        # Update the element's property unless it has focus
        return method: 'propPolite'
    
    'checked':
      '*': (events, attr, attrs, name) ->
        addDomEvent events, attrs, name, 'change', 'set', 'prop', 'checked'
        return method: 'prop', bool: true
    
    'selected':
      '*': (events, attr, attrs, name) ->
        addDomEvent events, attrs, name, 'change', 'set', 'prop', 'selected'
        return method: 'prop', bool: true
    
    'disabled':
      '*': (events, attr, attrs, name) ->
        return method: 'prop', bool: true

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

