htmlParser = require './htmlParser'
{modelPath, parsePlaceholder, parseElement, parseAttr} = require './parser'

View = module.exports = ->
  self = this
  @_views = {}
  @_paths = {}
  @_loadFuncs = ''
  
  # All automatically created ids start with a dollar sign
  @_idCount = 0
  @_uniqueId = -> '$' + (self._idCount++).toString 36
  
  return

View:: =

  get: (viewName, ctx, parentCtx, path, triggerPath) ->
    unless view = @_views[viewName]
      # Check to see if view is a block partial that hasn't been created yet,
      # because its parent hasn't been rendered. If so, render the parent and
      # try to get the block partial again
      if ~(i = viewName.indexOf '$')
        parentView = viewName.substr 1, i - 1
        # Make sure the parent view exists to avoid an infinte loop
        throw "Can't find view: #{parentView}"  unless @_views[parentView]
        @get parentView, {$triggerPath: triggerPath}
        return @get viewName, ctx, parentCtx, null, triggerPath
      # Return an empty string when a view can't be found
      return ''

    paths = parentCtx && parentCtx.$paths
    if path
      paths = @_paths[viewName] = if paths then [path].concat paths else [path]
    else
      @_paths[viewName] = paths ||= @_paths[viewName]

    type = viewName.charAt(0)
    # TODO: This is a hack to detect arrays, since Array.isArray doesn't work
    # on speculative array objects right now. This should be fixed in Racer
    if ctx && ctx.splice && ctx.slice
      if paths
        paths[0] += '.$#'
        parentCtx = Object.create parentCtx
        parentCtx.$paths = paths
      if ctx.length
        return ''  if type is '^'
        out = ''
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

  preLoad: (fn) -> @_loadFuncs += "(#{fn})();"

  make: (name, template, data = {}) ->
    self = this
    render = (ctx) ->
      if typeof template is 'string' && !/\{{2,3}|\({2,3}/.test(template)
        # Return the template without leading whitespace and newlines
        # if it is a string literal without placeholders
        template = trim template
        render = -> template
      else
        render = parse self, name, template, data
      render ctx

    fn = (ctx) -> render extend data, ctx
    @_register name, fn, data.Before, data.After

  _register: (name, fn, before, after) ->
    @_views[name] = if before
        if after then (ctx) ->
          before()
          setTimeout after, 0
          rendered = fn ctx
        else (ctx) ->
          before()
          fn ctx
      else
        if after then (ctx) ->
          setTimeout after, 0
          rendered = fn ctx
        else fn


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
trim = (s) -> if s then s.replace /(?:^|\n)\s*/g, '' else ''
trimInner = (s) -> if s then s.replace /\n\s*/g, '' else ''

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
    (?:\s+@([^\s>]))?  # Alias name
    (?:\s*>\s*([^\s]+)\s*)?  # Partial name
  ///.exec match[3]
  pre: trimInner match[1]
  escaped: match[2].length is 2
  literal: match[2].charAt(0) is '{'
  type: content[1]
  name: content[2]
  alias: content[3]
  partial: content[4]
  post: trimInner match[4]

startsEndBlock = (s) ->
  ///^
    (?:\{{2,3}|\({2,3})  # Start placeholder
    [/^]  # End block type
    (?:\}{2,3}|\){2,3})  # End placeholder
  ///.test s

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
        for key, value of item[2]
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

parsePlaceholderContent = (view, data, partialName, queues, popped, stack, events, block, match, callbacks) ->
  {literal, type, name, alias, partial} = match
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

parse = (view, viewName, template, data) ->
  return parseString view, viewName, template, data  if viewName is 'Title'

  uniqueId = view._uniqueId
  partialCount = 0
  partialName = -> viewName + '$' + partialCount++

  queues = [{stack: stack = [], events: events = []}]
  popped = []
  block = null

  htmlParser.parse template,
    start: (tag, tagName, attrs) ->
      if parser = parseElement[tagName]
        out = parser(events, attrs) || {}
        addId attrs, uniqueId  if out.addId

      for attr, value of attrs
        do (attr) ->
          if match = extractPlaceholder value
            {pre, post, name, partial, literal} = match
            addNameToData data, name
            invert = /^\s*!\s*$/.test pre
            if (pre && !invert) || post || partial
              # Attributes can't handle more than a single variable, so create
              # a string partial
              console.log 'TODO'

            if parser = parsePlaceholder[attr]
              if anyParser = parser['*']
                anyOut = anyParser events, attrs, name, invert
              if elParser = parser[tagName]
                elOut = elParser events, attrs, name, invert
            anyOut ||= {}
            elOut ||= {}
            method = elOut.method || anyOut.method || 'attr'
            bool = elOut.bool || anyOut.bool

            if data[name]?.model && !literal
              addId attrs, uniqueId
              events.push (data, modelEvents) ->
                args = [attrs._id || attrs.id, method, attr]
                args.push '$inv'  if invert
                modelEvents.bind path, args  if path = modelPath data, name

            attrs[attr] = if bool
                bool: (data, model) ->
                  if !dataValue(data, name, model) != !invert then ' ' + attr else ''
              else modelText view, name, attrEscape
          
          return  unless parser = parseAttr[attr]
          args = value.replace(/\s/g, '').split ':'
          args.unshift events, attrs
          addId attrs, uniqueId
          anyOut = anyParser args...  if anyParser = parser['*']
          elOut = elParser args...  if elParser = parser[tagName]
          anyOut ||= {}
          elOut ||= {}
          addId attrs, uniqueId  if elOut.addId || anyOut.addId
      
      stack.push ['start', tagName, attrs]

    chars: chars = (text) ->
      unless match = extractPlaceholder text
        stack.push ['chars', text]  if text = trimInner text
        return

      {pre, post, escaped, partial} = match
      pushText = (text, endBlock) -> stack.push ['chars', text]  if text && !endBlock
      pushText pre

      wrap = null
      parsePlaceholderContent view, data, partialName, queues, popped, stack, events, block, match,
        onBind: (name, partial, endBlock, lastAutoClosed, lastPartial) ->
          i = stack.length - (if endBlock then (if lastAutoClosed then 3 else 2) else 1)
          last = stack[i]
          if wrap = pre || (post && !startsEndBlock post) || !(last && last[0] == 'start')
            last = ['start', 'ins', {}]
            if endBlock then stack.splice i + 1, 0, last else stack.push last
          attrs = last[2]
          addId attrs, uniqueId

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
      view._register queue.viewName, (ctx) -> render extend data, ctx

  return renderer view, reduceStack(stack), events

parseString = (view, viewName, template, data) ->
  stack = []
  events = []

  post = template
  while post
    {name, pre, post} = extractPlaceholder post
    addNameToData data, name
    # TODO: Generalize HTML character entity replacement
    stack.push pre.replace('&rpar;', ')').replace('&lpar;', '(')  if pre
    stack.push modelText view, name
    params = ['$doc', 'prop', 'title', 'Title']  if viewName is 'Title'
    do (name) ->
      if params then events.push (data, modelEvents) ->
        return  unless path = modelPath data, name
        modelEvents.bind path, params.slice()

  renderer view, stack, events

