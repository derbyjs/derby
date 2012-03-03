{parse: parseHtml, unescapeEntities, escapeHtml, escapeAttr} = require './html'
{modelPath} = markup = require './markup'

empty = -> ''
notFound = (name) -> throw new Error "Can't find view: #{name}"
defaultCtx =
  $depth: 0
  $aliases: {}
  $paths: []
  $i: []

View = module.exports = ->
  @_views = Object.create @default
  @_inline = ''

  # All automatically created ids start with a dollar sign
  @_idCount = 0
  @_uniqueId = => '$' + (@_idCount++).toString 36

  return

View:: =

  default:
    doctype: -> '<!DOCTYPE html><meta charset=utf-8>'
    title$s: -> 'Derby app'
    head: empty
    header: empty
    body: empty
    scripts: empty
    tail: empty

  make: (name, template, isString) ->
    @make name + '$s', template, true  unless isString

    name = name.toLowerCase()
    render = (ctx) =>
      render = parse this, template, isString, onBind
      render ctx
    @_views[name] = (ctx) -> render ctx

    if name is 'title$s' then onBind = (events, name) ->
      bindEvents events, name, render, ['$doc', 'prop', 'title']

  _find: (name) -> @_views[name] || notFound name

  get: (name, ctx) ->
    @_find(name) if ctx then extend ctx, defaultCtx else Object.create defaultCtx

  before: (name, before) ->
    render = @_find name
    @_views[name] = (ctx, model, triggerPath) ->
      before ctx
      render ctx, model, triggerPath

  after: (name, after) ->
    render = @_find name
    @_views[name] = (ctx, model, triggerPath) ->
      setTimeout after, 0, ctx
      render ctx, model, triggerPath

  inline: empty

  render: (@model, ctx, silent) ->
    @_idCount = 0
    @model.__pathMap.clear()
    @model.__events.clear()
    @model.__blockPaths = {}
    @dom.clear()
    title = @get('title$s', ctx)
    bodyHtml = @get('header', ctx) + @get('body', ctx)
    return if silent
    container = document.createElement 'html'
    container.innerHTML = bodyHtml
    body = container.getElementsByTagName('body')[0]
    document.body.parentNode.replaceChild body, document.body
    document.title = title
  
  escapeHtml: escapeHtml
  escapeAttr: escapeAttr


extend = (parent, obj) ->
  out = Object.create parent
  return out  unless obj
  for key of obj
    out[key] = obj[key]
  return out

bindEvents = (events, name, fn, params) ->
  events.push (ctx, modelEvents, domEvents, pathMap, blockPaths, triggerId) ->
    return  unless path = modelPath ctx, name
    listener = if params.call then params triggerId, pathMap, blockPaths, path else params
    modelEvents.bind path, listener
    listener.fn = fn
    listener.ctx = ctx.$stringCtx || ctx
bindEventsById = (events, name, fn, attrs, method, prop, isBlock) ->
  bindEvents events, name, fn, (triggerId, pathMap, blockPaths, path) ->
    id = attrs._id || attrs.id
    blockPaths[id] = pathMap.id path  if pathMap && isBlock
    return [id, method, prop]
bindEventsByIdString = (events, name, fn, attrs, method, prop) ->
  bindEvents events, name, fn, (triggerId) ->
    id = triggerId || attrs._id || attrs.id
    return [id, method, prop]

addId = (view, attrs) ->
  unless attrs.id?
    attrs.id = -> attrs._id = view._uniqueId()

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
  bound: match[2].charAt(0) is '('
  type: content[1]
  name: content[2]
  alias: content[3]
  partial: content[4]?.toLowerCase()
  post: trim match[4]

# True if post begins with text that does not start an end block
wrapPost = (post) ->
  return false unless post
  return !///^
    (?:\{{2,3}|\({2,3})  # Start placeholder
    [/^]  # End block type
    (?:\}{2,3}|\){2,3})  # End placeholder
  ///.test post

dataValue = (ctx, model, name) ->
  if path = modelPath ctx, name
    if (value = model.get path)? then value else model[path]
  else
    ctx[name]

reduceStack = (stack) ->
  html = ['']
  i = 0
  for item in stack
    pushValue = (value, isAttr) ->
      if value && value.call
        i = html.push(value, '') - 1
      else
        html[i] += if isAttr then escapeAttr value else value

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
      when 'marker'
        html[i] += '<!--' + item[1]
        pushValue item[2].id
        html[i] += '-->'
  return html


renderer = (view, items, events) ->
  (ctx, model, triggerPath, triggerId) ->
    if triggerPath && path = ctx.$paths[0]
      _path = path.split '.'
      _triggerPath = triggerPath.split '.'
      indices = ctx.$i.slice()
      index = 0
      for segment, i in _path
        triggerSegment = _triggerPath[i]
        # `(n = +triggerSegment) == n` will be false if segment is NaN
        if segment is '$#' && (n = +triggerSegment) == n
          indices[index++] = n
        else if segment != triggerSegment
          break
      ctx.$i = indices

    model = view.model  # Needed, since model parameter is optional
    pathMap = model.__pathMap
    modelEvents = model.__events
    blockPaths = model.__blockPaths
    domEvents = view.dom.events
    html = ''
    for item in items
      html += if item.call then item(ctx, model, triggerPath) || '' else item
    i = 0
    while event = events[i++]
      event ctx, modelEvents, domEvents, pathMap, blockPaths, triggerId
    return html

parseMatch = (view, match, queues, {onStart, onEnd, onVar}) ->
  {type, name} = match
  {block} = queues.last()

  if type is '/'
    endBlock = true
  else if type is '^'
    startBlock = true
    if block && block.type is '#' && (!name || name == block.name)
      endBlock = true
  else if type is '#'
    startBlock = true

  if endBlock
    throw new Error 'Unmatched template end tag'  unless block
    match.name = block.name
    endQueue = queues.pop()

  if startBlock
    queues.push queue =
      stack: []
      events: []
      block: match
    queue.closed = endQueue  if endBlock
    onStart queue
  else
    if endBlock
      onStart queues.last()
      onEnd endQueue
    else
      onVar match
  return

extendCtx = (ctx, value, name, alias, index, isArray) ->
  ctx = extend ctx, value
  if path = modelPath ctx, name, true
    ctx.$paths = [path].concat ctx.$paths
  if alias
    aliases = ctx.$aliases = Object.create ctx.$aliases
    aliases[alias] = ctx.$depth
  ctx.$depth++  if name
  if index?
    ctx.$i = ctx.$i.concat index
    isArray = true
  ctx.$paths[0] += '.$#'  if isArray && ctx.$paths[0]
  return ctx

partialFn = (name, type, alias, render) ->
  (ctx, model, triggerPath, triggerId, value, index, useValue) ->
    unless useValue
      value = if name then dataValue ctx, model, name else true
    
    if Array.isArray value
      if type is '#'
        ctx = extendCtx ctx, null, name, alias, null, true
        out = ''
        indices = ctx.$i
        for item, i in value
          _ctx = extend ctx, item
          _ctx.$i = indices.concat i
          out += render _ctx, model, triggerPath
        return out
      else
        unless value.length
          ctx = extendCtx ctx, value, name, alias, index
          return render ctx, model, triggerPath
    else
      if (if type is '#' then value else !value)
        ctx = extendCtx ctx, value, name, alias, index
        return render ctx, model, triggerPath

textFn = (name, escape) ->
  (ctx, model) ->
    text = dataValue ctx, model, name
    text = if text? then text.toString() else ''
    return if escape then escape text else text

blockFn = (view, queue) ->
  return unless queue
  {stack, events, block} = queue
  {name, escaped, type, alias} = block
  render = renderer view, reduceStack(stack), events
  return partialFn name, type, alias, render

parseMarkup = (type, attr, tagName, events, attrs, name, invert) ->
  return  unless parser = markup[type][attr]
  if anyParser = parser['*']
    anyOut = anyParser events, attrs, name, invert
  if elParser = parser[tagName]
    elOut = elParser events, attrs, name, invert
  out = if anyOut then extend anyOut, elOut else elOut
  delete attrs[attr]  if out?.del
  return out

pushChars = (stack, text) ->
  stack.push ['chars', text]  if text

pushVarFns = (view, stack, fn, fn2, name, escaped) ->
  if fn
    pushChars stack, fn
    pushChars stack, fn2
  else
    pushChars stack, textFn name, escaped && escapeHtml

pushVar = (view, stack, events, pre, post, match, fn, fn2) ->
  {name, escaped, bound, alias, partial} = match
  fn = partialFn name, '#', alias, view._find partial  if partial

  if bound
    last = stack[stack.length - 1]
    if wrap = pre || !last || (last[0] != 'start') || wrapPost(post)
      stack.push ['marker', '', attrs = {}]
    else
      tagName = last[1]
      for attr of attrs = last[2]
        parseMarkup 'boundParent', attr, tagName, events, attrs, name
    addId view, attrs

    bindEventsById events, name, fn, attrs, 'html', !fn && escaped, true
    bindEventsById events, name, fn2, attrs, 'append'  if fn2

  pushVarFns view, stack, fn, fn2, name, escaped
  stack.push ['marker', '$', {id: -> attrs._id}]  if wrap

pushVarString = (view, stack, events, pre, post, match, fn, fn2) ->
  {name, bound, alias, partial} = match
  fn = partialFn name, '#', alias, view._find(partial + '$s')  if partial
  bindOnce = (ctx) ->
    ctx.$onBind events, name
    bindOnce = empty
  if bound then events.push (ctx) -> bindOnce ctx
  pushVarFns view, stack, fn, fn2, name

parse = null
forAttr = (view, stack, events, tagName, attrs, attr, value) ->
  if match = extractPlaceholder value
    {pre, post, name, bound, partial} = match
    
    invert = /^\s*!\s*$/.test pre
    if (pre && !invert) || post || partial
      # Attributes must be a single string, so create a string partial
      addId view, attrs
      render = parse view, value, true, (events, name) ->
        bindEventsByIdString events, name, render, attrs, 'attr', attr
      attrs[attr] = (ctx, model) -> escapeAttr render(ctx, model)
      return

    out = parseMarkup 'bound', attr, tagName, events, attrs, name, invert

    if bound
      addId view, attrs
      fn = '$inv'  if invert
      bindEventsById events, name, fn, attrs, out?.method || 'attr', attr

    unless out?.del
      attrs[attr] = if out?.bool
          bool: (ctx, model) ->
            if !dataValue(ctx, model, name) == invert then ' ' + attr else ''
        else textFn name, escapeAttr

  out = parseMarkup 'attr', attr, tagName, events, attrs, value
  addId view, attrs  if out?.addId

parse = (view, template, isString, onBind) ->
  queues = [{stack: stack = [], events: events = []}]
  queues.last = -> queues[queues.length - 1]

  if isString
    push = pushVarString
    if onBind then pushChars stack, (ctx) ->
      ctx.$onBind = onBind
      ctx.$stringCtx = ctx
      return ''
  else
    push = pushVar

  start = (tag, tagName, attrs) ->
    if parser = markup.element[tagName]
      out = parser(events, attrs)
      addId view, attrs  if out?.addId

    for attr, value of attrs
      continue if attr is 'style'
      forAttr view, stack, events, tagName, attrs, attr, value
    if 'style' of attrs
      forAttr view, stack, events, tagName, attrs, 'style', attrs.style

    stack.push ['start', tagName, attrs]

  chars = (text, literal) ->
    if literal || !(match = extractPlaceholder text)
      pushChars stack, trim(text)
      return

    {pre, post} = match
    pre = unescapeEntities pre  if isString
    pushChars stack, pre

    parseMatch view, match, queues,
      onStart: (queue) ->
        {stack, events, block} = queue
      onEnd: (queue) ->
        fn = blockFn view, queue
        fn2 = blockFn view, queue.closed
        push view, stack, events, pre, post, queue.block, fn, fn2
      onVar: (match) ->
        push view, stack, events, pre, post, match
    
    chars post  if post

  end = (tag, tagName) ->
    stack.push ['end', tagName]

  if isString
    chars template
  else
    parseHtml template, {start, chars, end}
  
  return renderer view, reduceStack(stack), events
