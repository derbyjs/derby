htmlParser = require './htmlParser'

extend = (parent, obj) ->
  return parent  unless obj
  return obj  unless parent
  out = Object.create parent
  for key of obj
    out[key] = obj[key]
  return out

View = module.exports = ->
  self = this
  @_views = {}
  @_loadFuncs = ''
  
  # All automatically created ids start with an underscore
  @uniqueId = -> '_' + (self._idCount++).toString 36
  
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
    if template.model || !~template.indexOf('{{')
      data = template
      # Remove leading whitespace and newlines from static strings
      data = data.replace /^|\n[\s]*/g, ''  if typeof data is 'string'
      simple = true
    else
      data = {}  if data is undefined
    
    options = options || data
    before = options.Before
    after = options.After
    uniqueId = @uniqueId
    self = this

    render = (ctx) ->
      render = if simple then parseSimple name, self else
        parse template, data, uniqueId, self
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

extractPlaceholder = (text) ->
  match = /^([^\{]*)(\{{2,3})([^\}]+)\}{2,3}(.*)$/.exec text
  return null unless match
  content = /^([#^//>%]?) *([^ >]*)(?: *> *(.*))?$/.exec match[3]
  pre: match[1]
  escaped: match[2] == '{{'
  type: content[1]
  name: content[2]
  partial: content[3]
  post: match[4]

addNameToData = (data, name) ->
  data[name] = model: name  unless name of data

modelPath = (data, name) ->
  return null  unless path = data[name].model
  path.replace /\(([^)]+)\)/g, (match, name) -> data[name]

modelText = (view, name, escaped, quote) ->
  (data, model) ->
    text = if path = modelPath data, name then model.get path else data[name]
    text = if `text == null` then '' else text.toString()
    text = htmlEscape text  if escaped
    text = quoteAttr text  if quote
    return text

getElementParse = (view, events) ->
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

parse = (template, data, uniqueId, view) ->
  stack = []
  events = []
  html = ['']
  htmlIndex = 0

  elementParse = getElementParse view, events

  htmlParser.parse template,
    start: (tag, attrs) ->
      for key, value of attrs
        if match = extractPlaceholder value
          {name, escaped} = match
          addNameToData data, name
          (attrs.id = -> attrs._id = uniqueId())  if attrs.id is undefined
          method = if tag of elementParse then elementParse[tag] key, attrs, name else 'attr'
          events.push (data, modelEvents) ->
            path = modelPath data, name
            modelEvents.bind path, [attrs._id || attrs.id, method, key]  if path
          attrs[key] = modelText view, name, escaped, true
      stack.push ['start', tag, attrs]

    chars: chars = (text) ->
      if match = extractPlaceholder text
        {name, escaped, pre, post, type, partial} = match
        addNameToData data, name
        stack.push ['chars', pre]  if pre
        last = stack[stack.length - 1]
        if wrap = pre || post || !(last && last[0] == 'start')
          stack.push last = ['start', 'span', {}]
        text = if partial then (data, model) ->
            view.get partial, model.get(name), data
          else modelText view, name, escaped
        attrs = last[2]
        (attrs.id = -> attrs._id = uniqueId())  if attrs.id is undefined
        events.push (data, modelEvents) ->
          return  unless path = modelPath data, name
          params = [attrs._id || attrs.id, 'html', +escaped]
          params[3] = partial  if partial
          modelEvents.bind path, params
      stack.push ['chars', text]  if text
      stack.push ['end', 'span']  if wrap
      chars post  if post

    end: (tag) ->
      stack.push ['end', tag]

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

  (data) ->
    model = view.model
    modelEvents = model.__events
    rendered = ((if item.call then item data, model else item) for item in html).join ''
    event data, modelEvents for event in events
    return rendered

parseSimple = (name, view) ->
  (datum) ->
    path = datum.model
    model = view.model
    text = if path then model.get path else datum
    model.__events.bind path, ['$doc', 'prop', 'title']  if path and name is 'Title'
    return text
