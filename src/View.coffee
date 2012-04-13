{parse: parseHtml, unescapeEntities, escapeHtml, escapeAttr, isVoid} = require './html'
markup = require './markup'
{trim, wrapRemainder, ctxPath, extractPlaceholder, dataValue, pathFnArgs} = require './viewPath'

empty = -> ''
notFound = (name, ns) ->
  name = ns + ':' + name if ns
  throw new Error "Can't find view: #{name}"
defaultCtx =
  $depth: 0
  $aliases: {}
  $paths: []
  $indices: []

defaultGetFns =
  equal: (a, b) -> a == b
  not: (value) -> !value

defaultSetFns =
  equal: (value, a) -> if value then [a] else []
  not: (value) -> [!value]

View = module.exports = ->
  @clear()
  @getFns = Object.create defaultGetFns
  @setFns = Object.create defaultSetFns

  @_componentNamespaces = {app: true}
  @_nonvoidComponents = {}
  return

View:: =

  clear: ->
    @_views = Object.create @default
    @_made = {}
    @_renders = {}
    @_inline = ''
    @_idCount = 0

  # All automatically created ids start with a dollar sign
  _uniqueId: -> '$' + (@_idCount++).toString 36

  default:
    doctype: -> '<!DOCTYPE html>'
    root: empty
    charset: -> '<meta charset=utf-8>'
    title$s: empty
    head: empty
    header: empty
    body: empty
    footer: empty
    scripts: empty
    tail: empty

  make: (name, template, options, templatePath, boundMacro) ->
    # Cache any templates that are made so that they can be
    # re-parsed with different items bound when using macros
    @_made[name] = [template, options, templatePath]
    @_nonvoidComponents[name] = true if options && 'nonvoid' of options

    if templatePath && render = @_renders[templatePath]
      @_views[name] = render
      return

    name = name.toLowerCase()

    if name is 'title'
      @make 'title$s', template, options, templatePath
    else if name is 'title$s'
      isString = true
      onBind = (events, name) ->
        macro = false
        bindEvents events, macro, name, render, ['$_doc', 'prop', 'title']

    renderer = (ctx) =>
      renderer = parse this, name, template, isString, onBind, boundMacro
      renderer ctx
    render = (ctx) -> renderer ctx

    @_views[name] = render
    @_renders[templatePath] = render if templatePath
    return

  _makeAll: (templates, instances) ->
    for name, [templatePath, options] of instances
      @make name, templates[templatePath], options, templatePath
    return

  _findItem: (name, ns, prop) ->
    items = @[prop]
    if ns
      ns = ns.toLowerCase()
      return item if item = items["#{ns}:#{name}"]
      segments = ns.split ':'
      if (from = segments.length - 2) >= 0
        for i in [from..0]
          testNs = segments[0..i].join ':'
          return item if item = items["#{testNs}:#{name}"]
      return items[name]
    return items[name]

  _find: (name, ns, boundMacro) ->
    if boundMacro && (hash = keyHash boundMacro)
      hash = '$b:' + hash
      hashedName = name + hash
      return out if out = @_findItem hashedName, ns, '_views'
      [template, options, templatePath] = @_findItem(name, ns, '_made') || notFound name, ns
      templatePath += hash
      @make hashedName, template, options, templatePath, boundMacro
      return @_find hashedName, ns
    return @_findItem(name, ns, '_views') || notFound name, ns

  get: (name, ns, ctx) ->
    if typeof ns is 'object'
      ctx = ns
      ns = ''
    ctx = if ctx then extend ctx, defaultCtx else Object.create defaultCtx
    @_find(name, ns) ctx

  inline: empty

  fn: (name, fn) ->
    if typeof fn is 'object'
      {get, set} = fn
    else
      get = fn
    @getFns[name] = get
    @setFns[name] = set if set

  render: (@model, ns, ctx, silent) ->
    if typeof ns is 'object'
      silent = ctx
      ctx = ns
      ns = ''

    @_idCount = 0
    @model.__pathMap.clear()
    @model.__events.clear()
    @model.__blockPaths = {}
    @dom.clear()

    title = @get('title$s', ns, ctx)
    rootHtml = @get('root', ns, ctx)
    bodyHtml = @get('header', ns, ctx) + @get('body', ns, ctx) + @get('footer', ns, ctx)
    return if silent

    doc = document
    documentElement = doc.documentElement

    # Remove all current attributes on the documentElement and replace
    # them with the attributes in the rendered rootHtml.
    for attr in documentElement.attributes
      documentElement.removeAttribute attr.name
    # Using the DOM to get the attributes on an <html> tag would require
    # some sort of iframe hack until DOMParser has better browser support.
    # String parsing the html should be simpler and more efficient
    parseHtml rootHtml, start: (tag, tagName, attrs) ->
      return unless tagName is 'html'
      for attr, value of attrs
        documentElement.setAttribute attr, value
      return

    fakeRoot = doc.createElement 'html'
    fakeRoot.innerHTML = bodyHtml
    body = fakeRoot.getElementsByTagName('body')[0]
    documentElement.replaceChild body, doc.body
    doc.title = title

  escapeHtml: escapeHtml
  escapeAttr: escapeAttr

View.trim = trim

keyHash = (obj) ->
  keys = []
  for key of obj
    keys.push key
  return keys.sort().join(',')

extend = (parent, obj) ->
  out = Object.create parent
  if typeof obj isnt 'object' || Array.isArray(obj)
    return out
  for key of obj
    out[key] = obj[key]
  return out

modelListener = (params, triggerId, blockPaths, pathId, partial, ctx) ->
  listener = if params.call then params triggerId, blockPaths, pathId else params
  listener.partial = partial
  listener.ctx = ctx.$stringCtx || ctx
  return listener

bindEvents = (events, macro, name, partial, params) ->
  if ~name.indexOf('(')
    args = pathFnArgs name
    return unless args.length
    events.push (ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId) ->
      listener = modelListener params, triggerId, blockPaths, null, partial, ctx
      listener.getValue = (model, triggerPath) ->
        patchCtx ctx, triggerPath
        return dataValue view, ctx, model, name, macro
      for arg in args
        path = ctxPath ctx, arg, macro
        pathId = pathMap.id path + '*'
        modelEvents.bind pathId, listener
      return
    return

  match = /(\.*)(.*)/.exec name
  prefix = match[1] || ''
  relativeName = match[2] || ''
  segments = relativeName.split '.'
  i = segments.length + 1
  while --i
    bindName = prefix + segments.slice(0, i).join('.')
    do (bindName) ->
      events.push (ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId) ->
        return unless path = ctxPath ctx, name, macro
        pathId = pathMap.id path
        listener = modelListener params, triggerId, blockPaths, pathId, partial, ctx
        if name != bindName
          path = ctxPath ctx, bindName, macro
          pathId = pathMap.id path
          listener.getValue = (model, triggerPath) ->
            patchCtx ctx, triggerPath
            return dataValue view, ctx, model, name, macro
        modelEvents.bind pathId, listener

bindEventsById = (events, macro, name, partial, attrs, method, prop, isBlock) ->
  bindEvents events, macro, name, partial, (triggerId, blockPaths, pathId) ->
    id = attrs._id || attrs.id
    blockPaths[id] = pathId  if isBlock && pathId
    return [id, method, prop]

bindEventsByIdString = (events, macro, name, partial, attrs, method, prop) ->
  bindEvents events, macro, name, partial, (triggerId) ->
    id = triggerId || attrs._id || attrs.id
    return [id, method, prop]

addId = (view, attrs) ->
  unless attrs.id?
    attrs.id = -> attrs._id = view._uniqueId()

reduceStack = (stack) ->
  html = ['']
  i = 0

  pushValue = (value, isAttr) ->
    if value && value.call
      i = html.push(value, '') - 1
    else
      html[i] += if isAttr then escapeAttr value else value

  for item in stack
    switch item[0]
      when 'start'
        html[i] += '<' + item[1]
        attrs = item[2]
        # Make sure that the id attribute is rendered first
        if 'id' of attrs
          html[i] += ' id='
          pushValue attrs.id, true
        for key, value of attrs
          continue if key is 'id'
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

patchCtx = (ctx, triggerPath) ->
  return unless triggerPath && path = ctx.$paths[0]
  segments = path.split '.'
  triggerSegments = triggerPath.replace(/\*$/, '').split '.'
  indices = ctx.$indices.slice()
  index = indices.length
  for segment, i in segments
    triggerSegment = triggerSegments[i]
    # `(n = +triggerSegment) == n` will be false if segment is NaN
    if segment is '$#' && (n = +triggerSegment) == n
      indices[--index] = n
    else if segment != triggerSegment
      break
  ctx.$indices = indices

renderer = (view, items, events, onRender) ->
  (ctx, model, triggerPath, triggerId) ->
    patchCtx ctx, triggerPath

    model ||= view.model  # Needed, since model parameter is optional
    pathMap = model.__pathMap
    modelEvents = model.__events
    blockPaths = model.__blockPaths
    dom = view.dom
    html = ''
    ctx = onRender ctx if onRender
    for item in items
      html += if item.call then item(ctx, model) || '' else item
    i = 0
    while event = events[i++]
      event ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId
    return html

extendCtx = (ctx, value, name, alias, index, isArray) ->
  ctx = extend ctx, value
  ctx.this = value
  if alias
    aliases = ctx.$aliases = Object.create ctx.$aliases
    aliases[alias] = ctx.$depth
  if path = ctxPath ctx, name, null, true
    ctx.$paths = [path].concat ctx.$paths
  ctx.$depth++  if name
  if index?
    ctx.$indices = [index].concat ctx.$indices 
    isArray = true
  ctx.$paths[0] += '.$#'  if isArray && ctx.$paths[0]
  return ctx

partialValue = (view, ctx, model, name, value, listener, macro) ->
  if listener
    return value
  return if name then dataValue view, ctx, model, name, macro else true

partialFn = (view, name, type, alias, render, macroCtx, macro) ->
  conditionalRender = (ctx, model, triggerPath, value, index, condition) ->
    if condition
      renderCtx = extendCtx ctx, value, name, alias, index
      return render renderCtx, model, triggerPath
    return ''

  withFn = (ctx, model, triggerPath, triggerId, value, index, listener) ->
    value = partialValue view, ctx, model, name, value, listener, macro
    return conditionalRender ctx, model, triggerPath, value, index, true

  if type is 'partial'
    return (ctx, model, triggerPath, triggerId, value, index, listener) ->
      renderCtx = Object.create ctx
      renderCtx.$macroCtx = if parentMacroCtx = ctx.$macroCtx
        extend parentMacroCtx, macroCtx
      else
        macroCtx
      return render renderCtx, model, triggerPath

  if type is 'with' || type is 'else'
    return withFn

  if type is 'if' || type is 'else if'
    return (ctx, model, triggerPath, triggerId, value, index, listener) ->
      value = partialValue view, ctx, model, name, value, listener, macro
      condition = !!(if Array.isArray(value) then value.length else value)
      return conditionalRender ctx, model, triggerPath, value, index, condition

  if type is 'unless'
    return (ctx, model, triggerPath, triggerId, value, index, listener) ->
      value = partialValue view, ctx, model, name, value, listener, macro
      condition = !(if Array.isArray(value) then value.length else value)
      return conditionalRender ctx, model, triggerPath, value, index, condition

  if type is 'each'
    return (ctx, model, triggerPath, triggerId, value, index, listener) ->
      value = partialValue view, ctx, model, name, value, listener, macro
      isArray = Array.isArray(value)

      if listener && !isArray
        return withFn ctx, model, triggerPath, triggerId, value, index, true

      return '' unless isArray

      ctx = extendCtx ctx, null, name, alias, null, true

      out = ''
      indices = ctx.$indices
      for item, i in value
        renderCtx = extend ctx, item
        renderCtx.this = item
        renderCtx.$indices = [i].concat indices
        out += render renderCtx, model, triggerPath
      return out

  throw new Error 'Unknown block type: ' + type

objectToString = Object::toString

textFn = (view, name, escape, macro) ->
  (ctx, model) ->
    value = dataValue view, ctx, model, name, macro
    text = if typeof value is 'string' then value else
      if `value == null` then '' else
        if value.toString is objectToString
          JSON.stringify value
        else
          value.toString()
    return if escape then escape text else text

sectionFn = (view, queue) ->
  render = renderer view, reduceStack(queue.stack), queue.events
  {block} = queue
  return partialFn view, block.name, block.type, block.alias, render, null, block.macro

blockFn = (view, sections) ->
  return unless len = sections.length
  if len is 1
    return sectionFn view, sections[0]
  else
    fns = (sectionFn view, section for section in sections)
    return (ctx, model, triggerPath, triggerId, value, index, listener) ->
      for fn in fns
        out = fn ctx, model, triggerPath, triggerId, value, index, listener
        return out if out
      return ''

parseMarkup = (type, attr, tagName, events, attrs, name) ->
  return  unless parser = markup[type][attr]
  if anyParser = parser['*']
    anyOut = anyParser events, attrs, name
  if elParser = parser[tagName]
    elOut = elParser events, attrs, name
  out = if anyOut then extend anyOut, elOut else elOut
  delete attrs[attr]  if out?.del
  return out

pushChars = (stack, text) ->
  stack.push ['chars', text]  if text

pushVarFn = (view, stack, fn, name, escapeFn, macro) ->
  if fn
    pushChars stack, fn
  else
    pushChars stack, textFn(view, name, escapeFn, macro)

boundMacroName = (boundMacro, name) ->
  macroVar = name.split('.')[0]
  return boundMacro[macroVar]

isBound = (boundMacro, match, name) ->
  return match.bound unless name && match.macro
  if ~name.indexOf('(')
    args = pathFnArgs name
    for arg in args
      return true if boundMacroName boundMacro, arg
    return false
  return boundMacroName boundMacro, name

pushVar = (view, ns, stack, events, boundMacro, remainder, match, fn) ->
  {name, partial, macro} = match
  escapeFn = match.escaped && escapeHtml
  if partial
    fn = partialFn view, name, 'partial', match.alias, view._find(partial, ns, boundMacro), match.macroCtx

  if isBound boundMacro, match, name
    last = stack[stack.length - 1]
    wrap = match.pre ||
      !last ||
      (last[0] != 'start') ||
      isVoid(tagName = last[1]) ||
      wrapRemainder(tagName, remainder)

    if wrap
      stack.push ['marker', '', attrs = {}]
    else
      for attr of attrs = last[2]
        parseMarkup 'boundParent', attr, tagName, events, attrs, name
    addId view, attrs

    bindEventsById events, macro, name, fn, attrs, 'html', !fn && escapeFn, true

  pushVarFn view, stack, fn, name, escapeFn, macro
  stack.push ['marker', '$', {id: -> attrs._id}]  if wrap

pushVarString = (view, ns, stack, events, boundMacro, remainder, match, fn) ->
  {name} = match
  escapeFn = !match.escaped && unescapeEntities
  bindOnce = (ctx) ->
    ctx.$onBind events, name
    bindOnce = empty
  if isBound boundMacro, match, name then events.push (ctx) -> bindOnce ctx
  pushVarFn view, stack, fn, name, escapeFn, match.macro

parseMatchError = (text, message) ->
  throw new Error message + '\n\n' + text + '\n'

onBlock = (start, end, block, queues, callbacks) ->
  if end
    lastQueue = queues.pop()
    queue = queues.last()
    queue.sections.push lastQueue
  else
    queue = queues.last()

  if start
    boundMacro = Object.create queue.boundMacro
    queues.push queue =
      stack: []
      events: []
      block: block
      sections: []
      boundMacro: boundMacro
    callbacks.onStart queue
  else
    if end
      callbacks.onStart queue
      callbacks.onEnd queue.sections
      queue.sections = []
    else
      callbacks.onContent block
  return

parseMatch = (text, match, queues, callbacks) ->
  {hash, type, name} = match
  {block} = queues.last()
  blockType = block && block.type

  if type is 'if' || type is 'unless' || type is 'each' || type is 'with'
    if hash is '#'
      startBlock = true
    else if hash is '/'
      endBlock = true
    else
      parseMatchError text, type + ' blocks must begin with a #'

  else if type is 'else' || type is 'else if'
    if hash
      parseMatchError text, type + ' blocks may not start with ' + hash
    if blockType isnt 'if' && blockType isnt 'else if' &&
        blockType isnt 'unless' && blockType isnt 'each'
      parseMatchError text, type + ' may only follow `if`, `else if`, `unless`, or `each`'
    startBlock = true
    endBlock = true

  else if hash is '/'
    endBlock = true

  else if hash is '#'
    parseMatchError text, '# must be followed by `if`, `unless`, `each`, or `with`'

  if endBlock && !block
    parseMatchError text, 'Unmatched template end tag'

  onBlock startBlock, endBlock, match, queues, callbacks

parseAttr = (view, viewName, events, boundMacro, tagName, attrs, attr, value) ->
  return if typeof value is 'function'
  if match = extractPlaceholder value
    {name, macro} = match

    if match.pre || match.post
      # Attributes must be a single string, so create a string partial
      addId view, attrs
      render = parse view, viewName, value, true, (events, name) ->
        bindEventsByIdString events, macro, name, render, attrs, 'attr', attr
      , boundMacro

      attrs[attr] = if attr is 'id'
        (ctx, model) -> attrs._id = escapeAttr render(ctx, model)
      else
        (ctx, model) -> escapeAttr render(ctx, model)
      return

    out = parseMarkup('bound', attr, tagName, events, attrs, name) || {}

    if isBound boundMacro, match, name
      addId view, attrs
      bindEventsById events, macro, name, null, attrs, (out.method || 'attr'), (out.property || attr)

    unless out.del
      {macro} = match
      attrs[attr] = if out.bool
          bool: (ctx, model) ->
            if dataValue(view, ctx, model, name, macro) then ' ' + attr else ''
        else
          textFn view, name, escapeAttr, macro

  out = parseMarkup 'attr', attr, tagName, events, attrs, value
  addId view, attrs  if out?.addId
  return

parsePartialAttr = (view, viewName, events, attrs, attr, value) ->
  if attr is 'content'
    throw new Error 'components may not have an attribute named "content"'
  bound = false
  if match = extractPlaceholder value
    {name, bound} = match

    if match.pre || match.post
      throw new Error 'unimplemented: blocks in component attributes'

    attrs[attr] = $macroVar: name

  else if value == 'true'
    attrs[attr] = true
  else if value == 'false'
    attrs[attr] = false
  else if value == 'null'
    attrs[attr] = null
  else if !isNaN(value)
    attrs[attr] = +value

  return bound

partialName = (view, tagName) ->
  return unless ~(i = tagName.indexOf ':')
  tagNs = tagName[0...i]
  return unless view._componentNamespaces[tagNs]
  return partial = tagName.slice i + 1

parse = (view, viewName, template, isString, onBind, boundMacro = {}) ->
  queues = [
    stack: stack = []
    events: events = []
    sections: []
    boundMacro: boundMacro
  ]
  queues.last = -> queues[queues.length - 1]
  onStart = (queue) ->
    {stack, events, boundMacro} = queue

  if isString
    push = pushVarString
    onRender = (ctx) ->
      return ctx if ctx.$stringCtx
      ctx = Object.create ctx
      ctx.$onBind = onBind
      ctx.$stringCtx = ctx
      return ctx
  else
    push = pushVar

  ns = if ~(index = viewName.lastIndexOf ':') then viewName[0...index] else ''

  start = (tag, tagName, attrs) ->
    if partial = partialName view, tagName
      isNonvoid = view._findItem partial, ns, '_nonvoidComponents'
      for attr, value of attrs
        bound = parsePartialAttr view, viewName, events, attrs, attr, value
        boundMacro[attr] = true if bound

      block = {partial, macroCtx: attrs}
      if isNonvoid
        onBlock true, false, block, queues, {onStart}
      else
        push view, ns, stack, events, boundMacro, '', block
      return

    if parser = markup.element[tagName]
      out = parser(events, attrs)
      addId view, attrs  if out?.addId

    for attr, value of attrs
      parseAttr view, viewName, events, boundMacro, tagName, attrs, attr, value

    stack.push ['start', tagName, attrs]

  chars = (text, isRawText, remainder) ->
    if isRawText || !(match = extractPlaceholder text)
      text = if isString then unescapeEntities trim text else trim text
      pushChars stack, text
      return

    {pre, post} = match
    pre = unescapeEntities pre  if isString
    pushChars stack, pre
    remainder = post || remainder

    parseMatch text, match, queues,
      onStart: onStart
      onEnd: (sections) ->
        fn = blockFn view, sections
        push view, ns, stack, events, boundMacro, remainder, sections[0].block, fn
      onContent: (match) ->
        push view, ns, stack, events, boundMacro, remainder, match

    chars post  if post

  end = (tag, tagName) ->
    if partial = partialName view, tagName
      onBlock false, true, null, queues,
        onStart: onStart
        onEnd: ([queue]) ->
          block = queue.block
          block.macroCtx.content = renderer view, reduceStack(queue.stack), queue.events
          push view, ns, stack, events, boundMacro, '', block
      return

    stack.push ['end', tagName]

  if isString
    chars template
  else
    parseHtml template, {start, chars, end}

  return renderer view, reduceStack(stack), events, onRender
