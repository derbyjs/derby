htmlParser = require './htmlParser'

View = module.exports = ->
  @_views = {}
  @_loadFuncs = ''
  return

View:: =

  # All automatically created ids start with an underscore
  uniqueId: -> '_' + (@_idCount++).toString 36

  get: (view, obj) ->
    if view = @_views[view]
      if Array.isArray obj
        (view item for item in obj).join ''
      else view obj
    else ''

  preLoad: (fn) -> @_loadFuncs += "(#{fn})();"

  make: (name, data, template, options) ->
    after = options && options.after
    uniqueId = @uniqueId
    self = this

    render = ->
      render = if template
          parse template, uniqueId, self
        else simpleView name, self
      render arguments...

    @_register name, after, (if typeof data is 'function'
        -> render data arguments...
      else
        -> render data)

  _register: (name, after, fn) ->
    @_views[name] = if after then ->
        setTimeout after, 0
        fn arguments...
      else fn


View.htmlEscape = htmlEscape = (s) ->
  if `s == null` then '' else s.toString().replace /[&<>]/g, (s) ->
    switch s
      when '&' then '&amp;'
      when '<' then '&lt;'
      when '>' then '&gt;'
      else s

quoteAttr = (s) ->
  return '""' if `s == null` || s is ''
  s = s.toString().replace /"/g, '&quot;'
  if /[ =]/.test s then '"' + s + '"' else s

parse = (template, uniqueId, view) ->

  modelText = (name, escaped, quote) ->
    (data) ->
      datum = data[name]
      obj = if datum.model then view.model.get datum.model else datum
      text = if datum.view then view.get datum.view, obj else obj
      text = htmlEscape text  if escaped
      text = quoteAttr text  if quote
      text

  extractPlaceholder = (text) ->
    match = /^(.*?)(\{{2,3})(\w+)\}{2,3}(.*)$/.exec text
    if match
      pre: match[1]
      escaped: match[2] == '{{'
      name: match[3]
      post: match[4]
    else null

  stack = []
  events = []
  html = ['']
  htmlIndex = 0

  elementParse =
    input: (attr, attrs, name) ->
      return 'attr'  unless attr == 'value'
      method = 'propPolite'
      setMethod = 'set'
      if 'silent' of attrs
        method = 'prop'
        setMethod = 'setSilent'
        delete attrs.silent
      events.push (data) ->
        domArgs = [setMethod, data[name].model, attrs._id or attrs.id, 'prop', 'value']
        domEvents = view.dom.events
        domEvents.bind 'keyup', domArgs
        domEvents.bind 'keydown', domArgs
      return method

  htmlParser.parse template,
    start: (tag, attrs) ->
      for key, value of attrs
        if match = extractPlaceholder value
          name = match.name
          if attrs.id is undefined
            attrs.id = -> attrs._id = uniqueId()
          method = if tag of elementParse then elementParse[tag] key, attrs, name else 'attr'
          events.push (data) ->
            path = data[name].model
            view.model.__events.bind path, [attrs._id || attrs.id, method, key]  if path
          attrs[key] = modelText name, match.escaped, true
      stack.push ['start', tag, attrs]

    chars: (text) ->
      if match = extractPlaceholder text
        name = match.name
        escaped = +match.escaped
        pre = match.pre
        post = match.post
        stack.push ['chars', pre]  if pre
        stack.push ['start', 'span', {}]  if pre or post
        text = modelText name, escaped
        last = stack[stack.length - 1]
        if last[0] == 'start'
          attrs = last[2]
          if attrs.id is undefined
            attrs.id = -> attrs._id = uniqueId()
          events.push (data) ->
            path = data[name].model
            viewFunc = data[name].view
            params = [attrs._id || attrs.id, 'html', escaped]
            if path
              params.push viewFunc  if viewFunc
              view.model.__events.bind path, params
      stack.push ['chars', text]  if text
      stack.push ['end', 'span']  if pre or post
      htmlParse.chars post  if post

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

  (data, obj) ->
    rendered = ((if item && item.call then item data else item) for item in html).join ''
    event data for event in events
    return rendered

simpleView = (name, view) ->
  (datum) ->
    path = datum.model
    model = view.model
    obj = if path then model.get path else datum
    text = if datum.view then view.get datum.view, obj else obj
    model.__events.bind path, ['__document', 'prop', 'title']  if path and name is 'Title'
    return text && text.replace /\n/g, ''

