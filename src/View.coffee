htmlParser = require './htmlParser'
{modelPath, parsePlaceholder, parseElement, parseAttr, addDomEvent} = require './parser'

View = module.exports = ->
  self = this
  @_views = {}
  @_paths = {}
  @_onBinds = {}
  @_depths = {}
  @_aliases = {}
  @_partialIds = {}
  @_templates = {}
  @_inline = ''
  
  # All automatically created ids start with a dollar sign
  @_idCount = 0
  @_uniqueId = -> '$' + (self._idCount++).toString 36
  
  return

View:: =

  _find: (name) -> @_views[name] || do -> throw "Can't find view: #{name}"

  get: (viewName, ctx, parentCtx, path, triggerPath) ->
    type = viewName.charAt(0)
    unless view = @_views[viewName]
      # Check to see if view is a block partial that hasn't been created yet,
      # because its parent hasn't been rendered. If so, render the parent and
      # try to get the block partial again
      if ~(i = viewName.indexOf '$p')
        start = if type is '#' or type is '^' then 1 else 0
        parentView = viewName.substr start, i - start
        # Make sure the parent view exists to avoid an infinte loop
        @_find parentView
        @get parentView, {$triggerPath: triggerPath}
        return @get viewName, ctx, parentCtx, null, triggerPath
      # Return an empty string when a view can't be found
      return ''

    paths = parentCtx && parentCtx.$paths
    if path
      paths = @_paths[viewName] = if paths then [path].concat paths else [path]
    else
      @_paths[viewName] = paths ||= @_paths[viewName]

    # TODO: This is a hack to detect arrays, since Array.isArray doesn't work
    # on speculative array objects right now. This should be fixed in Racer
    if ctx && ctx.splice && ctx.slice
      if ctx.length
        return ''  if type is '^'
        out = ''
        if parentCtx
          parentCtx = Object.create parentCtx
          parentCtx.$paths = paths.slice()
          parentCtx.$paths[0] += '.$#'
          indicies = parentCtx.$i || []
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
    if (ctx.$paths = paths) && (triggerPath ||= ctx.$triggerPath)
      re = RegExp(paths[0].replace(/\$#|\./g, (match) -> if match is '.' then '\\.' else '(\\d+)'))
      ctx.$i = re.exec(triggerPath)?.slice(1).reverse()
    return view ctx

  make: (name, template, data = {}) ->
    unless data.$isString
      @make name + '$s', template, extend data, {$isString: true}
    
    name = name.toLowerCase()
    self = this
    render = (ctx) ->
      render = parse self, name, template, data, self._onBinds[name]
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

  inline: ->

  render: (@model, ctx) ->
    @model.__events.clear()
    @dom.events.clear()
    document.body.innerHTML = @get('header', ctx) + @get('body', ctx)
    document.title = @get 'title$s', ctx


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
addIdPartial = (attrs, uniqueId, partialIds, partial) ->
  return if attrs.id?
  fn = ->
    fn = -> partialIds[partial] = attrs._id = uniqueId()
    attrs._id = partialIds[partial] || attrs.id()
  attrs.id = -> fn()

View.htmlEscape = htmlEscape = (s) ->
  unless s? then '' else s.toString().replace /&(?!\s)|</g, (s) ->
    if s is '&' then '&amp;' else '&lt;'

View.attrEscape = attrEscape = (s) ->
  return '""' if `s == null` || s is ''
  s = s.toString().replace /&(?!\s)|"/g, (s) ->
    if s is '&' then '&amp;' else '&quot;'
  if /[ =<>']/.test s then '"' + s + '"' else s

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

currentDepth = (data, queues) ->
  data.$depth + queues.length

unaliasName = (data, queues, name) ->
  return name  unless name.charAt(0) is ':'
  i = name.indexOf '.'
  aliasName = name.substring 1, i
  remainder = name.substr i + 1
  # Calculate depth difference between alias's definition and usage
  offset = currentDepth(data, queues) - data.$aliases[aliasName]
  throw "Can't find alias for #{name}"  if offset != offset # If NaN
  # Convert depth difference to a relative model path
  return Array(offset + 1).join('.') + remainder

addNameToData = (data, name) ->
  data[name] = {model: name}  if name && !(name of data)

dataValue = (data, name, model) ->
  # Get the value from the model if the name is a model path
  if path = modelPath data, name
      # First try to get the path from the model data. Otherwise, assume it
      # is a built-in property of model
      if (value = model.get path)? then value else model[path]
    # If not a model path, check if the value is defined in the context data
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

parsePlaceholderContent = (view, data, partialName, queues, popped, stack, events, block, match, isString, onBind, callbacks) ->
  {literal, type, name, alias, partial} = match
  partial += '$s'  if partial && isString
  
  # Store depth when an alias is defined
  data.$aliases[alias] = currentDepth data, queues  if alias

  name = unaliasName data, queues, name
  addNameToData data, name
  
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

  if partial then partialText = (data, model) ->
    view._onBinds[partial] = onBind
    view._depths[partial] = currentDepth data, queues
    view._aliases[partial] = data.$aliases
    view.get partial, dataValue(data, name || '.', model), data, modelPath(data, name, true)

  if (datum = data[name])?
    if datum.model && !startBlock
      callbacks.onBind name, partial, endBlock, lastAutoClosed, lastPartial  unless literal
      callbacks.onModelText partialText, name, endBlock
    else callbacks.onText partialText, datum, endBlock
  else callbacks.onText partialText, '', endBlock

  if startBlock
    queues.push
      stack: stack = []
      events: events = []
      viewName: partial
      block: block
    callbacks.onStartBlock stack, events, block

parse = (view, viewName, template, data, onBind) ->
  partialCount = 0
  partialName = -> viewName + '$p' + partialCount++

  data.$depth = view._depths[viewName] || 0
  data.$aliases = view._aliases[viewName] || {}
  if data.$isString
    if viewName is 'title$s'
      onBind = (events, name) -> events.push (data, modelEvents) ->
        return  unless path = modelPath data, name
        modelEvents.bind path, ['$doc', 'prop', 'title', 'title$s']
    return parseString view, viewName, template, data, partialName, onBind || ->

  uniqueId = view._uniqueId
  
  queues = [{stack: stack = [], events: events = []}]
  popped = []
  block = null

  htmlParser.parse template,
    start: (tag, tagName, attrs) ->
      if parser = parseElement[tagName]
        out = parser(events, attrs) || {}
        addId attrs, uniqueId  if out.addId

      forAttr = (attr, value) ->
        if match = extractPlaceholder value
          {pre, post, name, partial, literal} = match
          name = unaliasName data, queues, name
          addNameToData data, name
          
          invert = /^\s*!\s*$/.test pre
          if (pre && !invert) || post || partial
            # Attributes must be a single string, so create a string partial
            partial = partialName()
            addIdPartial attrs, uniqueId, view._partialIds, partial
            render = parseString view, partial, value, data, partialName,
              (events, name) -> events.push (data, modelEvents) ->
                return  unless path = modelPath data, name
                modelEvents.bind path, [attrs._id || attrs.id, 'attr', attr, partial]
            view._views[partial] = (ctx) -> render extend data, ctx
            attrs[attr] = (data, model) -> attrEscape render(data, model)
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

          if data[name]?.model && !literal
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
      parsePlaceholderContent view, data, partialName, queues, popped, stack, events, block, match, false, null,
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
          addEvent lastPartial, 'appendHtml'  if lastAutoClosed

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
      render = renderer(view, reduceStack(queue.stack), queue.events)
      view._views[queue.viewName] = (ctx) -> render extend data, ctx

  return renderer view, reduceStack(stack), events

htmlUnescape = (s) ->
  # TODO: Generalize HTML character entity replacement
  s.replace('&rpar;', ')').replace('&lpar;', '(')

parseString = (view, viewName, template, data, partialName, onBind) ->
  queues = [{stack: stack = [], events: events = []}]
  popped = []
  block = null

  pushText = (text, endBlock) -> stack.push text  if text && !endBlock

  post = template
  while post
    match = extractPlaceholder post
    unless match?
      pushText htmlUnescape post
      break

    {pre, post} = match
    pushText htmlUnescape pre

    parsePlaceholderContent view, data, partialName, queues, popped, stack, events, block, match, true, onBind,
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
      render = renderer(view, queue.stack, queue.events)
      view._views[queue.viewName] = (ctx) -> render extend data, ctx

  renderer view, stack, events

