{merge} = require('racer').util
{ctxPath, pathFnArgs, setBoundFn} = require './viewPath'

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
      '*': (events, attrs, name) ->
        addDomEvent events, attrs, 'change', name, {method: 'prop', property: 'checked'}
        return method: 'prop'

    'selected':
      '*': (events, attrs, name) ->
        addDomEvent events, attrs, 'change', name, {method: 'prop', property: 'selected'}
        return method: 'prop'

    'disabled':
      '*': ->
        return method: 'prop'

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

    'checked':
      '*': -> bool: true

    'selected':
      '*': -> bool: true

    'disabled':
      '*': -> bool: true

  TEXT_EVENTS: TEXT_EVENTS = 'keyup,keydown,paste/0,dragover/0,blur'

  AUTOCOMPLETE_OFF: AUTOCOMPLETE_OFF =
    checkbox: true
    radio: true

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
      if ~name.indexOf('(')
        args = pathFnArgs name
        return unless args.length

        events.push (ctx, modelEvents, dom, pathMap, view) ->
          id = attrs._id || attrs.id
          paths = []
          options.setValue = (model, value) ->
            setBoundFn view, ctx, model, name, value
          for arg in args
            path = ctxPath ctx, arg
            paths.push path
            pathId = pathMap.id path
            for [eventName, delay] in eventList
              dom.bind eventName, id, merge({pathId, delay}, options)
          return
        return

      events.push (ctx, modelEvents, dom, pathMap) ->
        id = attrs._id || attrs.id
        pathId = pathMap.id ctxPath(ctx, name)
        for [eventName, delay] in eventList
          dom.bind eventName, id, merge({pathId, delay}, options)
        return
      return

    events.push (ctx, modelEvents, dom) ->
      id = attrs._id || attrs.id
      for [eventName, delay, fn] in eventList
        dom.bind eventName, id, merge({fn, delay}, options)
      return
