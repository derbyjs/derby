racer = require 'racer'
{lookup} = racer.path
{merge} = racer.util

module.exports =

  bound:
    'value':
      'input': (events, attrs, name) ->
        return if attrs.type is 'radio'

        if 'x-blur' of attrs
          # Only update after the element loses focus
          delete attrs['x-blur']
          eventNames = 'change,blur'
        else
          # By default, update as the user types
          eventNames = TEXT_EVENTS
        
        if 'x-ignore-focus' of attrs
          # Update value regardless of focus
          delete attrs['x-ignore-focus']
          method = 'prop'
        else
          # Update value unless window and element are focused
          method = 'propPolite'
        
        addDomEvent events, attrs, eventNames, name, {method: 'prop', property: 'value'}
        # Update the element's property unless it has focus
        return {method}

    'checked':
      '*': (events, attrs, name, invert) ->
        addDomEvent events, attrs, 'change', name, {method: 'prop', property: 'checked', invert}
        return method: 'prop', bool: true
    
    'selected':
      '*': (events, attrs, name, invert) ->
        addDomEvent events, attrs, 'change', name, {method: 'prop', property: 'selected', invert}
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
        addDomEvent events, attrs, TEXT_EVENTS, name, {method: 'html'}
        return

  element:
    'select': (events, attrs) ->
      # Distribute change event to child nodes of select elements
      addDomEvent events, attrs, 'change:$forChildren'
      return addId: true

    'input': (events, attrs) ->
      if AUTOCOMPLETE_OFF[attrs.type] && !('autocomplete' of attrs)
        attrs.autocomplete = 'off'

      if attrs.type is 'radio'
        # Distribute change events to other elements with the same name
        addDomEvent events, attrs, 'change:$forName'
      return

  attr:
    'x-bind':
      '*': (events, attrs, eventNames) ->
        addDomEvent events, attrs, eventNames
        return addId: true, del: true

      'a': onBindA = (events, attrs, eventNames) ->
        if containsEvent(eventNames, 'click') && !('href' of attrs)
          attrs.href = '#'
          unless 'onclick' of attrs
            attrs.onclick = 'return false'
        return

      'form': onBindForm = (events, attrs, eventNames) ->
        if containsEvent(eventNames, 'submit')
          unless 'onsubmit' of attrs
            attrs.onsubmit = 'return false'
        return

    'x-capture':
      '*': (events, attrs, eventNames) ->
        addDomEvent events, attrs, eventNames, null, {capture: true}
        return addId: true, del: true

      'a': onBindA

      'form': onBindForm

  TEXT_EVENTS: TEXT_EVENTS = 'keyup,keydown,paste/0,dragover/0,blur'

  AUTOCOMPLETE_OFF: AUTOCOMPLETE_OFF =
    checkbox: true
    radio: true

  # TODO: This function could be optimized to do some of these
  # checks on the name once insted of on every render
  modelPath: modelPath = (ctx, name, noReplace) ->
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
    return name.replace /\[([^\]]+)\]/g, (match, name) -> lookup name, ctx

  addConditionalStyle: addConditionalStyle = (attrs, name, invert, styleText) ->
    type = if invert then '#' else '^'
    cat = "{{#{type}#{name}}}#{styleText}{{/}}"
    attrs.style = if style = attrs.style then "#{style};#{cat}" else cat

  splitEvents: splitEvents = (eventNames) ->
    pairs = eventNames.replace(/\s/g, '').split ','
    out = []
    for pair in pairs
      segments = pair.split ':'
      [name, delay] = segments[0].split '/'
      fn = segments[1] || ''
      out.push [name, delay, fn]
    return out

  containsEvent: containsEvent = (eventNames, expected) ->
    for [eventName] in splitEvents eventNames
      return true if eventName is expected
    return false

  addDomEvent: addDomEvent = (events, attrs, eventNames, name, options) ->
    eventList = splitEvents eventNames

    if name
      {method, property, invert} = options
      if eventList.length == 1
        [eventName, delay] = eventList[0]
        events.push (ctx, modelEvents, dom, pathMap) ->
          pathId = pathMap.id modelPath(ctx, name)
          id = attrs._id || attrs.id
          dom.bind eventName, id, merge {pathId, delay}, options
          return
        return
      events.push (ctx, modelEvents, dom, pathMap) ->
        pathId = pathMap.id modelPath(ctx, name)
        id = attrs._id || attrs.id
        for [eventName, delay] in eventList
          dom.bind eventName, id, merge {pathId, delay}, options
        return
      return

    if eventList.length == 1
      [eventName, delay, fn] = eventList[0]
      events.push (ctx, modelEvents, dom) ->
        id = attrs._id || attrs.id
        dom.bind eventName, id, merge {fn, delay}, options
        return
      return
    events.push (ctx, modelEvents, dom) ->
      id = attrs._id || attrs.id
      for [eventName, delay, fn] in eventList
        dom.bind eventName, id, merge {fn, delay}, options
      return
