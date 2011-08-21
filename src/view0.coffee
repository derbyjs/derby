_ = require './utils'
htmlParser = require './htmlParser'

View = module.exports = ->
  @_views = {}
  @_loadFuncs = ''
  @_idCount = 0

  return

View:: =

  # All automatically created ids start with an underscore
  uniqueId: -> '_' + (@_idCount++).toString 36

  get: (view, obj) ->
    (if view = @_views[view]
      (if Array.isArray obj
        (view item for item in obj).join ''
       else view obj)
     else '')

  preLoad: (fn) -> @_loadFuncs += '(' + fn.toString() + ')();'

  make: (name, data, template, options) ->
    after = options && options.after
    render = ->
      render = if template then parse template else simpleView name
      render.apply null, arguments

    fn = (if _.isFunction data
      -> render data.apply null, arguments
     else
      -> render data)

    if _.onServer
      @preLoad after  if after
      views[name] = fn
    else
      views[name] = (if (after) then ->
        setTimeout after, 0
        fn.apply null, arguments
       else fn)


View.htmlEscape = htmlEscape = (s) ->
  if s == null then '' else s.toString()
  s.replace /[&<>]/g, (s) ->
    switch s
      when '&' then '&amp;'
      when '<' then '&lt;'
      when '>' then'&gt;'
      else s

quoteAttr = (s) ->
  s = String((if s == null then '' else s)).replace(/"/g, '&quot;')
  (if s then (if /[ =]/.test(s) then '"' + s + '"' else s) else '""')

parse = (template, uniqueId) ->

  modelText = (name, escaped, quote) ->
    (data) ->
      datum = data[name]
      obj = (if datum.model then model.get(datum.model) else datum)
      text = (if datum.view then get(datum.view, obj) else obj)
      text = htmlEscape(text)  if escaped
      text = quoteAttr(text)  if quote
      text

  extractPlaceholder = (text) ->
    match = /^(.*?)(\{{2,3})(\w+)\}{2,3}(.*)$/.exec(text)
    (if match then 
      pre: match[1]
      escaped: match[2] == '{{'
      name: match[3]
      post: match[4]
    else null)
  stack = []
  events = []
  html = ['']
  htmlIndex = 0
  elementParse = input: (attr, attrs, name) ->
    if attr == 'value'
      method = 'propPolite'
      setMethod = 'set'
      if 'silent' of attrs
        method = 'prop'
        setMethod = 'setSilent'
        delete attrs.silent
      events.push (data) ->
        domArgs = [ setMethod, data[name].model, attrs._id or attrs.id, 'prop', 'value' ]
        dom.events.bind 'keyup', domArgs
        dom.events.bind 'keydown', domArgs
    else
      method = 'attr'
    method

  htmlParse =
    start: (tag, attrs) ->
      _.forEach attrs, (key, value) ->
        if match = extractPlaceholder(value)
          name = match.name
          if _.isUndefined(attrs.id)
            attrs.id = ->
              attrs._id = uniqueId()
          method = (if (tag of elementParse) then elementParse[tag](key, attrs, name) else 'attr')
          events.push (data) ->
            path = data[name].model
            model.events.bind path, [ attrs._id or attrs.id, method, key ]  if path
          attrs[key] = modelText(name, match.escaped, true)
      stack.push [ 'start', tag, attrs ]

    chars: (text) ->
      if match = extractPlaceholder(text)
        name = match.name
        escaped = _.toNumber(match.escaped)
        pre = match.pre
        post = match.post
        stack.push [ 'chars', pre ]  if pre
        stack.push [ 'start', 'span', {} ]  if pre or post
        text = modelText(name, escaped)
        last = stack[stack.length - 1]
        if last[0] == 'start'
          attrs = last[2]
          if _.isUndefined(attrs.id)
            attrs.id = ->
              attrs._id = uniqueId()
          events.push (data) ->
            path = data[name].model
            viewFunc = data[name].view
            params = [ attrs._id or attrs.id, 'html', escaped ]
            if path
              params.push viewFunc  if viewFunc
              model.events.bind path, params
      stack.push [ 'chars', text ]  if text
      stack.push [ 'end', 'span' ]  if pre or post
      htmlParse.chars post  if post

    end: (tag) ->
      stack.push [ 'end', tag ]

  htmlParser.parse template, htmlParse

  stack.forEach (item) ->
    pushValue = (value, quote) ->
      if _.isFunction(value)
        htmlIndex = html.push(value, '') - 1
      else
        html[htmlIndex] += (if quote then quoteAttr(value) else value)

    switch item[0]
      when 'start'
        html[htmlIndex] += '<' + item[1]
        _.forEach item[2], (key, value) ->
          html[htmlIndex] += ' ' + key + '='
          pushValue value, true
        
        html[htmlIndex] += '>'
        return
      when 'chars'
        pushValue item[1]
        return
      when 'end'
        html[htmlIndex] += '</' + item[1] + '>'

  (data, obj) ->
    rendered = html.reduce((memo, item) ->
      memo + (if _.isFunction(item) then item(data) else item)
    , '')
    events.forEach (item) ->
      item data
    return rendered

simpleView = (name) ->
  (datum) ->
    path = datum.model
    obj = (if path then model.get(path) else datum)
    text = (if datum.view then get(datum.view, obj) else obj)
    model.events.bind path, [ '__document', 'prop', 'title' ]  if name == 'Title'  if path
    return text

