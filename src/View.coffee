htmlParser = require './htmlParser'
elementParser = require './elementParser'

View = module.exports = ->
  self = this
  @_views = {}
  @_loadFuncs = ''
  
  # All automatically created ids start with a dollar sign
  @_idCount = 0
  @_uniqueId = -> '$' + (self._idCount++).toString 36
  
  return

View:: =

  get: (viewName, ctx, parentCtx) ->
    unless view = @_views[viewName]
      # Check to see if view is a block partial that hasn't been created yet,
      # because its parent hasn't been rendered. If so, render the parent and
      # try to get the block partial again
      if ~(i = viewName.indexOf '$')
        parentView = viewName.substr 1, i - 1
        # Make sure the parent view exists to avoid an infinte loop
        throw "Can't find view: #{parentView}"  unless @_views[parentView]
        @get parentView
        return @get viewName, ctx, parentCtx
      # Return an empty string when a view can't be found
      return ''
    if parentCtx || ctx?
      # This is a partial
      type = viewName.charAt(0)
      if Array.isArray ctx
        if ctx.length
          return ''  if type is '^'
          return (view extend parentCtx, item for item in ctx).join ''
        else
          return ''  unless type is '^'
      else
        return ''  if (type is '^' && ctx) || (type is '#' && !ctx)
    return view extend parentCtx, ctx

  preLoad: (fn) -> @_loadFuncs += "(#{fn})();"

  make: (name, template, data = {}) ->
    self = this
    render = (ctx) ->
      if typeof template is 'string' && !~template.indexOf('{{')
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
  return obj  unless typeof parent is 'object'
  return parent  unless obj
  out = Object.create parent
  for key of obj
    out[key] = obj[key]
  return out

addId = (attrs, uniqueId) ->
  unless attrs.id? then attrs.id = -> attrs._id = uniqueId()

View.htmlEscape = htmlEscape = (s) ->
  unless s? then '' else s.replace /&(?!\s)|</g, (s) ->
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
  match = /^([^\{]*)(\{{2,3})([^\}]+)\}{2,3}([\s\S]*)/.exec text
  return  unless match
  content = /^([#^//]?) *([^ >]*)(?: *> *(.*))?/.exec match[3]
  pre: trimInner match[1]
  escaped: match[2] == '{{'
  type: content[1]
  name: content[2]
  partial: content[3]
  post: trimInner match[4]

addNameToData = (data, name) ->
  data[name] = {model: name}  if name && !(name of data)

modelPath = (data, name) ->
  datum = data[name]
  return null  unless datum && path = datum.model
  path.replace /\(([^)]+)\)/g, (match, name) -> data[name]

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

parse = (view, viewName, template, data) ->
  return parseString view, viewName, template, data  if viewName is 'Title'

  queues = [{stack: stack = [], events: events = []}]
  popped = []
  block = null

  uniqueId = view._uniqueId
  partialCount = 0
  partialName = -> viewName + '$' + partialCount++

  {parsePlaceholder, parseAttr} = elementParser events

  htmlParser.parse template,
    start: (tag, tagName, attrs) ->
      for attr, value of attrs
        do (attr) ->
          if match = extractPlaceholder value
            name = match.name
            addNameToData data, name

            if parser = parsePlaceholder[attr]
              if anyParser = parser['*']
                anyOut = anyParser events, attr, attrs, name
              if elParser = parser[tagName]
                elOut = elParser events, attr, attrs, name
            anyOut ||= {}
            elOut ||= {}
            method = elOut.method || anyOut.method || 'attr'
            bool = elOut.bool || anyOut.bool

            if data[name]?.model
              addId attrs, uniqueId
              events.push (data, modelEvents) ->
                path = modelPath data, name
                modelEvents.bind path, [attrs._id || attrs.id, method, attr]  if path

            attrs[attr] = if bool
                bool: (data, model) ->
                  if dataValue data, name, model then ' ' + attr else ''
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

      {pre, post, name, escaped, type, partial} = match
      addNameToData data, name

      stack.push ['chars', pre]  if pre

      if block && ((endBlock = type is '/') || (autoClosed = type is '^' && (!name || name == block.name) && block.type is '#'))
        {name, partial, lastPartial, lastAutoClosed} = block
        popped.push queues.pop()
        {stack, events, block} = queues[queues.length - 1]

      if startBlock = type is '#' || type is '^'
        lastPartial = partial
        partial = type + partialName()
        block = {type, name, partial, lastPartial, lastAutoClosed: autoClosed}

      text = unless partial then '' else
        (data, model) -> view.get partial, dataValue(data, name, model), data

      if (datum = data[name])?
        if datum.model && !startBlock
          # Setup binding if there is a variable or block name
          i = stack.length - (if endBlock then (if lastAutoClosed then 3 else 2) else 1)
          last = stack[i]
          if wrap = pre || post || !(last && last[0] == 'start')
            last = ['start', 'ins', {}]
            if endBlock then stack.splice i + 1, 0, last else stack.push last
          attrs = last[2]
          addId attrs, uniqueId

          addEvent = (partial, append) -> events.push (data, modelEvents) ->
            return  unless path = modelPath data, name
            escaped = false  if partial
            domMethod = if append then 'appendHtml' else 'html'
            params = [attrs._id || attrs.id, domMethod, +escaped]
            params[3] = partial  if partial
            modelEvents.bind path, params
          addEvent partial
          addEvent lastPartial, true  if lastAutoClosed

          text = text || modelText view, name, escaped && htmlEscape

        else text = text || if escaped then htmlEscape datum.toString() else datum.toString()

      stack.push ['chars', text]  if text && !endBlock
      stack.push ['end', 'ins']  if wrap

      if startBlock then queues.push
        stack: stack = []
        events: events = []
        viewName: partial
        block: block

      chars post  if post

    end: (tag, tagName) ->
      stack.push ['end', tagName]

  for queue in popped
    do (queue) ->
      render = renderer(view, reduceStack(queue.stack), queue.events)
      view._register queue.viewName, (ctx) -> render extend data, ctx
 
  return renderer view, reduceStack(stack), events

parseString = (view, viewName, template, data) ->
  items = []
  events = []

  post = template
  while post
    {name, pre, post} = extractPlaceholder post
    addNameToData data, name
    items.push pre  if pre
    items.push modelText view, name
    params = ['$doc', 'prop', 'title', 'Title']  if viewName is 'Title'
    do (name) ->
      if params then events.push (data, modelEvents) ->
        return  unless path = modelPath data, name
        modelEvents.bind path, params.slice()

  renderer view, items, events
