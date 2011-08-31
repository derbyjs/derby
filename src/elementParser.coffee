module.exports = (view, events) ->
  input: (attr, attrs, name) ->
    return 'attr'  unless attr == 'value'
    if 'silent' of attrs
      delete attrs.silent
      method = 'prop'
      silent = 1
    else
      # Update the property unless the element has focus
      method = 'propPolite'
      silent = 0
    events.push (data) ->
      domArgs = ['set', data[name].model, attrs._id || attrs.id, 'prop', 'value', silent]
      domEvents = view.dom.events
      domEvents.bind 'keyup', domArgs
      domEvents.bind 'keydown', domArgs
    return method
