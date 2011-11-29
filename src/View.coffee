{hasKeys} = require('racer').util
{parse: parseHtml, unescapeEntities, htmlEscape, attrEscape} = require './html'
{modelPath, parsePlaceholder, parseElement, parseAttr, addDomEvent} = require './parser'

empty = ->
View = module.exports = ->
  self = this
  @_views = {}
  @_paths = {}
  @_onBinds = {}
  @_aliases = {}
  @_templates = {}
  @_inline = ''
  
  # All automatically created ids start with a dollar sign
  @_idCount = 0
  @_uniqueId = -> '$' + (self._idCount++).toString 36
  
  return

View:: =

  _find: (name) -> @_views[name] || do -> throw "Can't find view: #{name}"

  get: (viewName, ctx, parentCtx, path, triggerPath, triggerId) ->
    type = viewName.charAt(0)
    unless view = @_views[viewName]
      # Check to see if view is a block partial that hasn't been created yet,
      # because its parent hasn't been rendered. If so, render the parent and
      # try to get the block partial again
      if ~(i = viewName.indexOf '$p')
        start = if type is '#' or type is '^' then 1 else 0
        parentView = viewName.substr start, i - start
        # Make sure the parent view exists to avoid an infinite loop
        @_find parentView
        @get parentView, parentCtx = {}
        return @get viewName, ctx, parentCtx, null, triggerPath, triggerId
      # Return an empty string when a view can't be found
      return ''

    unless paths = @_paths[viewName]
      paths = parentCtx && parentCtx.$paths
      if path
        paths = @_paths[viewName] = if paths then [path].concat paths else [path]

    # Get the proper context if this was triggered by an event
    if `ctx == null` && triggerPath
      ctx = @model.get triggerPath

    if Array.isArray ctx
      if ctx.length
        return ''  if type is '^'
        out = ''
        if parentCtx
          parentCtx = Object.create parentCtx
          parentCtx.$paths = (paths && paths.slice()) || []
          parentCtx.$paths[0] += '.$#'
          indicies = parentCtx.$i
        indicies ||= []
        for item, i in ctx
          obj = extend parentCtx, item
          obj.$i = [i].concat indicies
          out += view obj
        return out
      else
        return ''  unless type is '^'
    else
      return ''  if (type is '^' && ctx) || (type is '#' && !ctx)
    
    ctx = extend parentCtx, ctx
    ctx.$triggerId = triggerId
    if triggerPath
      ctx.$triggerPath = triggerPath
    else
      triggerPath = ctx.$triggerPath
    if (ctx.$paths = paths) && triggerPath
      path = paths[0]
      if path.charAt(path.length - 1) != '#' && /\.\d+$/.test triggerPath
        # If path points to an array and an event was triggered on an item
        # in the array, add the index placeholder to the first path
        ctx.$paths = paths = paths.slice()
        paths[0] = path += '.$#'
      re = RegExp(
        path.replace /\.|\$#/g, (match) ->
          if match is '.' then '\\.' else '(\\d+)'
      )
      ctx.$i = re.exec(triggerPath)?.slice(1).reverse()  unless '$i' of ctx
    return view ctx

  make: (name, template, data = {}) ->
    unless data.$isString
      @make name + '$s', template, extend data, {$isString: true}
    
    name = name.toLowerCase()
    self = this
    render = (ctx) ->
      render = parse self, name, template, data, ctx, self._onBinds[name]
      render ctx
    @_views[name] = (ctx) -> render extend data, ctx

  before: (name, before) ->
    fn = @_find name
    @_views[name] = (ctx) ->
      before ctx
      fn ctx

  after: (name, after) ->
    fn = @_find name
    @_views[name] = (ctx) ->
      setTimeout after, 0, ctx
      fn ctx

  inline: empty

  render: (@model, ctx, silent) ->
    @model.__events.clear()
    @dom.events.clear()
    title = @get 'title$s', ctx
    body = @get('header', ctx) + @get('body', ctx)
    return if silent
    document.body.innerHTML = body
    document.title = title
  
  htmlEscape: htmlEscape
  attrEscape: attrEscape


extend = (parent, obj) ->
  unless typeof parent is 'object'
    return if typeof obj is 'object' then obj else {}
  out = Object.create parent
  return out  unless obj
  for key of obj
    out[key] = obj[key]
  return out

addId = (attrs, uniqueId) ->
  unless attrs.id? then attrs.id = -> attrs._id = uniqueId()

# Remove leading whitespace and newlines from a string. Note that trailing
# whitespace is not removed in case whitespace is desired between lines
View.trim = trim = (s) -> if s then s.replace /\n\s*/g, '' else ''

extractPlaceholder = (text) ->
  match = ///^
    ([^\{\(]*)  # Text before placeholder
    (\{{2,3}|\({2,3})  # Placeholder start
    ([^\}\)]+)  # Placeholder contents
    (?:\}{2,3}|\){2,3})  # End placeholder
    ([\s\S]*)  # Text after placeholder
  ///.exec text
  return  unless match
  content = ///^
    \s*([\#^/]?)  # Block type
    \s*([^\s>]*)  # Name of context object
    (?:\s+:([^\s>]+))?  # Alias name
    (?:\s*>\s*([^\s]+)\s*)?  # Partial name
  ///.exec match[3]
  pre: trim match[1]
  escaped: match[2].length is 2
  literal: match[2].charAt(0) is '{'
  type: content[1]
  name: content[2]
  alias: content[3]
  partial: content[4]?.toLowerCase()
  post: trim match[4]

startsEndBlock = (s) ->
  ///^
    (?:\{{2,3}|\({2,3})  # Start placeholder
    [/^]  # End block type
    (?:\}{2,3}|\){2,3})  # End placeholder
  ///.test s

unaliasName = (data, depth, name) ->
  return name  unless name.charAt(0) is ':'
  i = name.indexOf '.'
  aliasName = name.substring 1, i
  remainder = name.substr i + 1
  # Calculate depth difference between alias's definition and usage
  offset = depth - data.$aliases[aliasName]
  throw "Can't find alias for #{name}"  if offset != offset # If NaN
  # Convert depth difference to a relative model path
  return Array(offset + 1).join('.') + remainder

dataValue = (data, name, model) ->
  # Get the value from the model if the name is a model path
  if path = modelPath data, name
    # First try to get the path from the model data. Otherwise, assume it
    # is a built-in property of model
    if (value = model.get path)? then value else model[path]
  # If not a model path, use value in the context data
  else data[name]

modelText = (view, name, escape) ->
  (data, model) ->
    text = dataValue data, name, model
    text = if text? then text.toString() else ''
    text = escape text  if escape
    return text

reduceStack = (stack) ->
  html = ['']
  i = 0
  for item in stack
    pushValue = (value, isAttr) ->
      if value && value.call
        i = html.push(value, '') - 1
      else
        html[i] += if isAttr then attrEscape value else value

    switch item[0]
      when 'start'
        html[i] += '<' + item[1]
        attrs = item[2]
        if 'id' of attrs
          html[i] += ' id='
          pushValue attrs.id, true
        for key, value of attrs
          continue  if key is 'id'
          if value?
            if bool = value.bool
              pushValue bool
              continue
            html[i] += ' ' + key + '='
            pushValue value, true
          else html[i] += ' ' + key
        html[i] += '>'
      when 'chars'
        pushValue item[1]
      when 'end'
        html[i] += '</' + item[1] + '>'
  return html

renderer = (view, items, events) ->
  (data) ->
    model = view.model
    modelEvents = model.__events
    domEvents = view.dom.events
    html = ((if item.call then item data, model else item) for item in items).join ''
    event data, modelEvents, domEvents for event in events
    return html

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
      view._onBinds[partial] = onBind
      data.$depth = depth + queues.length
      view.get partial, dataValue(data, name || '.', model), data,
        modelPath(data, name, true), data.$triggerPath

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

parse = (view, viewName, template, data, ctx, onBind) ->
  partialCount = 0
  partialName = -> viewName + '$p' + partialCount++

  if hasKeys ctx.$aliases
    view._aliases[viewName] = [
      data.$aliases = ctx.$aliases
      depth = ctx.$depth || 0
    ]
  else if aliases = view._aliases[viewName]
    [data.$aliases, depth] = aliases
  else
    data.$aliases = ctx.$aliases || {}
    depth = ctx.$depth || 0

  if data.$isString
    if viewName is 'title$s'
      onBind = (events, name) -> events.push (data, modelEvents) ->
        return  unless path = modelPath data, name
        modelEvents.bind path, ['$doc', 'prop', 'title', 'title$s']
    return parseString view, viewName, template, data, depth, partialName, onBind || empty

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
    do (queue) ->
      render = renderer view, reduceStack(queue.stack), queue.events
      view._views[queue.viewName] = (ctx) -> render extend data, ctx

  return renderer view, reduceStack(stack), events

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
    do (queue) ->
      render = renderer view, queue.stack, queue.events
      view._views[queue.viewName] = (ctx) -> render extend data, ctx

  renderer view, stack, events

