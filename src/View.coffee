htmlParser = require './htmlParser'
elementParser = require './elementParser'

View = module.exports = ->
  self = this
  @_views = {}
  @_loadFuncs = ''
  
  # All automatically created ids start with a dollar sign
  @uniqueId = -> '$' + (self._idCount++).toString 36
  
  return

View:: =

  get: (view, ctx, parentCtx) ->
    if view = @_views[view]
      if ctx && Array.isArray ctx
        out = ''
        for item in ctx
          out += view extend parentCtx, item
        return out
      else view extend parentCtx, ctx
    else ''

  preLoad: (fn) -> @_loadFuncs += "(#{fn})();"

  make: (name, template, data, options) ->
    if typeof template is 'string' && !~template.indexOf('{{')
      # Remove leading whitespace and newlines
      template = trim template
      literal = true
    else
      data = {}  if data is undefined
    
    if options = options || data
      before = options.Before
      after = options.After
    uniqueId = @uniqueId
    self = this

    render = (ctx) ->
      render = if literal then -> template else
        parse self, name, template, data, uniqueId
      render ctx

    @_register name, before, after,
      if typeof data is 'object'
        (ctx) -> render extend data, ctx
      else if typeof data is 'function'
        (ctx) -> render extend data(ctx), ctx
      else
        -> render data

  _register: (name, before, after, fn) ->
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
  return parent  unless obj
  return obj  unless parent
  out = Object.create parent
  for key of obj
    out[key] = obj[key]
  return out

View.htmlEscape = htmlEscape = (s) ->
  if `s == null` then '' else s.replace /[&<>]/g, (s) ->
    switch s
      when '&' then '&amp;'
      when '<' then '&lt;'
      when '>' then '&gt;'
      else s

quoteAttr = (s) ->
  return '""' if `s == null` || s is ''
  s = s.toString().replace /"/g, '&quot;'
  if /[ =]/.test s then '"' + s + '"' else s

# Remove leading whitespace and newlines from a string. Note that trailing
# whitespace is not removed in case whitespace is desired between lines
trim = (s) -> s.replace /^|\n[\s]*/g, ''

extractPlaceholder = (text) ->
  match = /^([^\{]*)(\{{2,3})([^\}]+)\}{2,3}([\s\S]*)/.exec text
  return null unless match
  content = /^([#^//]?) *([^ >]*)(?: *> *(.*))?/.exec match[3]
  pre: trim match[1]
  escaped: match[2] == '{{'
  type: content[1]
  name: content[2]
  partial: content[3]
  post: trim match[4]

addNameToData = (data, name) ->
  data[name] = model: name  unless name of data

modelPath = (data, name) ->
  datum = data[name]
  return null  unless datum && path = datum.model
  path.replace /\(([^)]+)\)/g, (match, name) -> data[name]

modelText = (view, name, escaped, quote) ->
  (data, model) ->
    text = if path = modelPath data, name then model.get path else data[name]
    text = if `text == null` then '' else text.toString()
    text = htmlEscape text  if escaped
    text = quoteAttr text  if quote
    return text

renderer = (view, items, events) ->
  (data) ->
    model = view.model
    modelEvents = model.__events
    rendered = ((if item.call then item data, model else item) for item in items).join ''
    event data, modelEvents for event in events
    return rendered

parseChars = (view, uniqueId, stack, events, pre, post, name, escaped, type, partial) ->
  switch type
    when '#' then stack.push ['section', name]; return
    when '^' then stack.push ['inverted', name]; return
    when '/' then stack.push ['endSection', name]; return

  last = stack[stack.length - 1]
  if wrap = pre || post || !(last && last[0] == 'start')
    stack.push last = ['start', 'span', {}]
  attrs = last[2]
  (attrs.id = -> attrs._id = uniqueId())  if attrs.id is undefined

  events.push (data, modelEvents) ->
    return  unless path = modelPath data, name
    params = [attrs._id || attrs.id, 'html', +escaped]
    params[3] = partial  if partial
    modelEvents.bind path, params

  text = if partial then (data, model) ->
      view.get partial, model.get(name), data
    else modelText view, name, escaped
  stack.push ['chars', text]
  stack.push ['end', 'span']  if wrap

parse = (view, viewName, template, data, uniqueId) ->
  return parseString view, viewName, template, data  if viewName is 'Title'

  stack = []
  events = []
  html = ['']
  htmlIndex = 0
  elements = elementParser view, events

  htmlParser.parse template,
    start: (tag, attrs) ->
      for key, value of attrs
        if match = extractPlaceholder value
          {name, escaped} = match
          addNameToData data, name  if name
          
          (attrs.id = -> attrs._id = uniqueId())  if attrs.id is undefined
          method = if tag of elements then elements[tag] key, attrs, name else 'attr'
          
          events.push (data, modelEvents) ->
            path = modelPath data, name
            modelEvents.bind path, [attrs._id || attrs.id, method, key]  if path
          
          attrs[key] = modelText view, name, escaped, true
      
      stack.push ['start', tag, attrs]

    chars: chars = (text) ->
      return  unless match = extractPlaceholder text
      {pre, post, name, escaped, type, partial} = match
      addNameToData data, name  if name
        
      stack.push ['chars', pre]  if pre
      parseChars view, uniqueId, stack, events, pre, post, name, escaped, type, partial
      chars post  if post

    end: (tag) ->
      stack.push ['end', tag]

  console.log stack
  
  for item in stack
    pushValue = (value, quote) ->
      if value && value.call
        htmlIndex = html.push(value, '') - 1
      else
        html[htmlIndex] += if quote then quoteAttr value else value

    switch item[0]
      when 'start'
        html[htmlIndex] += '<' + item[1]
        for key, value of item[2]
          html[htmlIndex] += ' ' + key + '='
          pushValue value, true
        html[htmlIndex] += '>'
      when 'chars'
        pushValue item[1]
      when 'end'
        html[htmlIndex] += '</' + item[1] + '>'

  renderer view, html, events

parseString = (view, viewName, template, data) ->
  items = []
  events = []

  post = template
  while match = extractPlaceholder post
    {name, pre, post} = match
    addNameToData data, name
    items.push pre  if pre
    items.push modelText view, name
    params = ['$doc', 'prop', 'title', 'Title']  if viewName is 'Title'
    if params then events.push (data, modelEvents) ->
      return  unless path = modelPath data, name
      modelEvents.bind path, params.slice()

  renderer view, items, events
