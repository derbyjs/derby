module.exports = (events) ->
  events: events

  addDomEvent: addDomEvent = (attrs, name, eventNames, onMethod, getMethod, property) ->
    isArray = Array.isArray eventNames
    events.push (data, modelEvents, domEvents) ->
      args = [onMethod, data[name].model, attrs._id || attrs.id, getMethod, property]
      return domEvents.bind eventNames, args  unless isArray
      for eventName in eventNames
        domEvents.bind eventName, args

  parsePlaceholder:
    'value':
      input: (attr, attrs, name) ->
        if 'x-blur' of attrs
          # Only update after the element loses focus
          delete attrs['x-blur']
          eventNames = 'change'
        else
          # By default, update on any event that could change the value
          eventNames = ['keyup', 'keydown', 'paste', 'dragend']
        
        addDomEvent attrs, name, eventNames, 'set', 'prop', 'value'
        # Update the element's property unless it has focus
        return 'propPolite'
    
    'checked':
      input: (attr, attrs, name) ->
        # Checked is a boolean attribute....
        addDomEvent attrs, name, 'change', 'set', 'prop', 'value'
        return 'prop'

  parseAttr:
    'x-bind':
      '*': (attrs, name, fn) ->
        delete attrs['x-bind']
        events.push (data, modelEvents, domEvents) ->
          domEvents.bind name, [fn, attrs._id || attrs.id]
        return true
      a: (attrs, name) ->
        if name is 'click' && !('href' of attrs)
          attrs.href = '#'
          attrs.onclick = 'return false'  unless 'onclick' of attrs
      form: (attrs, name) ->
        console.log attrs, name
        if name is 'submit'
          attrs.onsubmit = 'return false'  unless 'onsubmit' of attrs

