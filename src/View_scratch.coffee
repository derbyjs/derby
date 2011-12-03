parsePlaceholderContent = (view, data, depth, partialName, queues, popped, stack, events, block, match, isString, onBind, callbacks) ->
  {literal, type, name, alias, partial} = match
  partial += '$s'  if partial && isString
  
  # Store depth when an alias is defined
  data.$aliases[alias] = depth + queues.length  if alias

  name = unaliasName data, depth + queues.length, name
  
  if block && ((endBlock = type is '/') ||
      (autoClosed = type is '^' && (!name || name == block.name) && block.type is '#'))
    {name, partial, literal, lastPartial, lastAutoClosed} = block
    popped.push queues.pop()
    {stack, events, block} = queues[queues.length - 1]
    callbacks.onStartBlock stack, events, block

  if startBlock = type is '#' || type is '^'
    lastPartial = partial
    partial = type + partialName()
    block = {type, name, partial, literal, lastPartial, lastAutoClosed: autoClosed}

  if partial
    partialText = (data, model) ->
      ctx = Object.create data
      view._onBinds[partial] = onBind
      ctx.$depth = depth + queues.length
      if path = modelPath ctx, name, true
        ctx.$paths = data.$paths.concat path
      # ctx = dataValue data, name || '.', model
      view.get partial, ctx, data.$triggerPath

  if name of data || startBlock
    callbacks.onText partialText, data[name], endBlock
  else
    unless literal
      callbacks.onBind name, partial, endBlock, lastAutoClosed, lastPartial
    callbacks.onModelText partialText, name, endBlock

  if startBlock
    queues.push
      stack: stack = []
      events: events = []
      viewName: partial
      block: block
    callbacks.onStartBlock stack, events, block

parse = (view, viewName, template) ->

  # if hasKeys data.$aliases
  #   view._aliases[viewName] = [
  #     data.$aliases = data.$aliases
  #     depth = ctx.$depth || 0
  #   ]
  # else if aliases = view._aliases[viewName]
  #   [data.$aliases, depth] = aliases
  # else
  #   data.$aliases = ctx.$aliases || {}
  #   depth = ctx.$depth || 0

  # if data.$isString
  #   if viewName is 'title$s'
  #     onBind = (events, name) -> events.push (data, modelEvents) ->
  #       return  unless path = modelPath data, name
  #       modelEvents.bind path, ['$doc', 'prop', 'title', 'title$s']
  #   return parseString view, viewName, template, data, depth, partialName, onBind || empty

  uniqueId = view._uniqueId
  
  queues = [{stack: stack = [], events: events = []}]
  popped = []
  block = null

  parseHtml template,
    start: (tag, tagName, attrs) ->
      if parser = parseElement[tagName]
        out = parser(events, attrs) || {}
        addId attrs, uniqueId  if out.addId

      forAttr = (attr, value) ->
        if match = extractPlaceholder value
          {pre, post, name, partial, literal} = match
          name = unaliasName data, depth + queues.length, name
          
          invert = /^\s*!\s*$/.test pre
          if (pre && !invert) || post || partial
            # Attributes must be a single string, so create a string partial
            partial = partialName()
            addId attrs, uniqueId
            render = parseString view, partial, value, data, depth, partialName,
              (events, name) -> events.push (data, modelEvents) ->
                attrs._id = id  if id = data.$triggerId
                return  unless path = modelPath data, name
                modelEvents.bind path, [attrs._id || attrs.id, 'attr', attr, partial]
            view._views[partial] = (ctx) -> render extend data, ctx
            attrs[attr] = (data, model) -> attrEscape render(data, model)

            # TODO: Come up with something cleaner here. Just trying to get the paths set
            _data = Object.create data
            _data.$depth = depth + queues.length
            view.get partial, null, _data, modelPath(_data, name, true)
            return

          if parser = parsePlaceholder[attr]
            if anyParser = parser['*']
              anyOut = anyParser events, attrs, name, invert
            if elParser = parser[tagName]
              elOut = elParser events, attrs, name, invert
          anyOut ||= {}
          elOut ||= {}
          method = elOut.method || anyOut.method || 'attr'
          bool = elOut.bool || anyOut.bool
          del = elOut.del || anyOut.del

          if !(name of data) && !literal
            addId attrs, uniqueId
            events.push (data, modelEvents) ->
              return  unless path = modelPath data, name
              args = [attrs._id || attrs.id, method, attr]
              args[3] = '$inv'  if invert
              modelEvents.bind path, args

          if del
            delete attrs[attr]
          else
            attrs[attr] = if bool then bool: (data, model) ->
                if !dataValue(data, name, model) != !invert then ' ' + attr else ''
              else modelText view, name, attrEscape
          
        return  unless parser = parseAttr[attr]
        anyOut = anyParser events, attrs, value  if anyParser = parser['*']
        elOut = elParser events, attrs, value  if elParser = parser[tagName]
        anyOut ||= {}
        elOut ||= {}
        addId attrs, uniqueId  if elOut.addId || anyOut.addId

      for attr, value of attrs
        continue if attr is 'style'
        forAttr attr, value
      forAttr 'style', attrs.style  if 'style' of attrs
      
      stack.push ['start', tagName, attrs]

    chars: chars = (text, literal) ->
      if literal || !(match = extractPlaceholder text)
        stack.push ['chars', text]  if text = trim text
        return

      {pre, post, escaped} = match
      pushText = (text, endBlock) -> stack.push ['chars', text]  if text && !endBlock
      pushText pre

      wrap = null
      parsePlaceholderContent view, data, depth, partialName, queues, popped, stack, events, block, match, false, null,
        onBind: (name, partial, endBlock, lastAutoClosed, lastPartial) ->
          i = stack.length - (if endBlock then (if lastAutoClosed then 3 else 2) else 1)
          last = stack[i]
          if wrap = pre || (post && !startsEndBlock post) || !(last && last[0] == 'start')
            last = ['start', 'ins', {}]
            if endBlock then stack.splice i + 1, 0, last else stack.push last
          attrs = last[2]
          addId attrs, uniqueId

          if 'contenteditable' of attrs
            addDomEvent events, attrs, name, 'input', 'html'

          addEvent = (partial, domMethod) -> events.push (data, modelEvents) ->
            return  unless path = modelPath data, name
            params = [attrs._id || attrs.id, domMethod, +escaped]
            params[3] = partial  if partial
            modelEvents.bind path, params
          addEvent partial, 'html'
          addEvent lastPartial, 'append'  if lastAutoClosed

        onModelText: (partialText, name, endBlock) ->
          escaped = false  if partialText
          pushText (partialText || modelText view, name, escaped && htmlEscape), endBlock
          stack.push ['end', 'ins']  if wrap

        onText: (partialText, value, endBlock) ->
          escaped = false  if partialText
          pushText (partialText || if escaped then htmlEscape value else value.toString()), endBlock

        onStartBlock: (_stack, _events, _block) ->
          stack = _stack
          events = _events
          block = _block

      chars post  if post

    end: (tag, tagName) ->
      stack.push ['end', tagName]

  for queue in popped
    renderer view, queue.viewName, data, reduceStack(queue.stack), queue.events
  renderer view, viewName, data, reduceStack(stack), events

parseString = (view, viewName, template, data, depth, partialName, onBind) ->
  queues = [{stack: stack = [], events: events = []}]
  popped = []
  block = null

  pushText = (text, endBlock) -> stack.push text  if text && !endBlock

  post = template
  while post
    match = extractPlaceholder post
    unless match?
      pushText unescapeEntities post
      break

    {pre, post} = match
    pushText unescapeEntities pre

    parsePlaceholderContent view, data, depth, partialName, queues, popped, stack, events, block, match, true, onBind,
      onBind: (name) -> onBind events, name

      onModelText: (partialText, name, endBlock) ->
        pushText (partialText || modelText view, name), endBlock

      onText: (partialText, value, endBlock) ->
        pushText (partialText || value.toString()), endBlock

      onStartBlock: (_stack, _events, _block) ->
        stack = _stack
        events = _events
        block = _block

  for queue in popped
    renderer view, queue.viewName, data, queue.stack, queue.events
  renderer view, viewName, data, stack, events
