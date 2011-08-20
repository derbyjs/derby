swapQuotes = (s) ->
  s.replace /['"]/g, (match) ->
    (if match == "\"" then "'" else "\"")
_ = require("./utils")
EventDispatcher = module.exports = (onTrigger, onBind, onUnbind) ->
  empty = ->
  
  @_onTrigger = onTrigger or empty
  @_onBind = onBind or empty
  @_onUnbind = onUnbind or empty
  @trigger = (if _.onServer then empty else @_trigger)
  @_names = {}

EventDispatcher:: = 
  bind: (name, listener) ->
    return  if @_onBind(name, listener) == false
    names = @_names
    key = (if _.isDefined(listener) then JSON.stringify(listener) else "null")
    obj = names[name] or {}
    obj[key] = true
    names[name] = obj
  
  unbind: (name, listener) ->
    return  if @_onUnbind(name, listener) == false
    names = @_names
    obj = names[name]
    key = JSON.stringify(listener)
    if obj
      delete obj[key]  if obj[key]
      delete names[name]  unless Object.keys(obj).length
  
  _trigger: (name, value, options) ->
    names = @_names
    listeners = names[name]
    onTrigger = @_onTrigger
    i = 0
    deleted = 0
    for key of listeners
      i++
      listener = JSON.parse(key)
      if onTrigger(name, listener, value, options) == false
        delete listeners[key]
        
        deleted++
    delete names[name]  if i - deleted == 0
  
  get: ->
    names = @_names
    out = {}
    Object.keys(names).forEach (name) ->
      out[name] = Object.keys(names[name]).map(swapQuotes)
    
    out
  
  set: (n) ->
    names = @_names
    Object.keys(n).forEach (name) ->
      obj = names[name] = {}
      listeners = n[name]
      listeners.forEach (listener) ->
        obj[swapQuotes(listener)] = true
element = (id) ->
  elements[id] or (elements[id] = doc.getElementById(id))
onTrigger = (name, listener, targetId) ->
  func = listener[0]
  path = listener[1]
  id = listener[2]
  method = listener[3]
  property = listener[4]
  if id == targetId
    el = element(id)
    return false  unless el
    value = getMethods[method](el, property)
    model[func].apply null, [ path, value ]
onBind = (name) ->
  addListener name  unless (name of events._names)
domHandler = (e) ->
  e = e or event
  target = e.target or e.srcElement
  target = target.parentNode  if target.nodeType == 3
  events.trigger e.type, target.id
_ = require("./utils")
EventDispatcher = require("./EventDispatcher")
win = not _.onServer and window
doc = win and win.document
elements = 
  __document: doc
  __window: win

emptyEl = (if doc then doc.createElement("div") else null)
getMethods = 
  attr: (el, attr) ->
    el.getAttribute attr
  
  prop: (el, prop) ->
    el[prop]
  
  html: (el) ->
    el.innerHTML

setMethods = 
  attr: (value, el, attr) ->
    el.setAttribute attr, value
  
  prop: (value, el, props) ->
    if _.isArray(props)
      last = props.length - 1
      i = 0
      
      while i < last
        el = el[props[i]]
        i++
      prop = props[last]
    else
      prop = props
    el[prop] = value
  
  propPolite: (value, el, prop) ->
    el[prop] = value  if el != doc.activeElement
  
  html: (value, el, escape) ->
    el.innerHTML = view.htmlEscape(value)  if escape
  
  appendHtml: (value, el) ->
    emptyEl.innerHTML = value
    while child = emptyEl.firstChild
      el.appendChild child

exports._link = (m, v) ->
  model = m
  view = v

exports.update = (id, method, property, viewFunc, value) ->
  el = element(id)
  return false  unless el
  s = (if (viewFunc) then view._get(viewFunc, value) else value)
  setMethods[method] s, el, property

events = exports.events = new EventDispatcher(onTrigger, onBind)

if doc.addEventListener
  addListener = (name) ->
    doc.addEventListener name, domHandler, false
  
  removeListener = (name) ->
    doc.removeEventListener name, domHandler, false
else if doc.attachEvent
  addListener = (name) ->
    doc.attachEvent "on" + name, domHandler
  
  removeListener = (name) ->
    doc.detachEvent "on" + name, domHandler
else
  addListener = removeListener = ->
exports.addListener = addListener
exports.removeListener = removeListener
exports.init = (domEvents) ->
  events.set domEvents
  Object.keys(events._names).forEach addListener
startTag = /^<(\w+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)?)?)*)\s*(\/?)>/
endTag = /^<\/(\w+)[^>]*>/
attr = /(\w+)(?:\s*(=)\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+))?)?/g
comment = /<!--[\s\S]*?-->(?:\n\s*)?/g
endingSpace = /\n\s*$/
exports.parse = (html, handler) ->
  parseStartTag = (tag, tagName, rest) ->
    attrs = {}
    rest.replace attr, (match, name, equals, attr0, attr1, attr2) ->
      attrs[name.toLowerCase()] = attr0 or attr1 or attr2 or (if equals then "" else null)
    
    startHandler tagName.toLowerCase(), attrs
  parseEndTag = (tag, tagName) ->
    endHandler tagName.toLowerCase()
  empty = ->
  
  charsHandler = (handler and handler.chars) or empty
  startHandler = (handler and handler.start) or empty
  endHandler = (handler and handler.end) or empty
  html = html.replace(comment, "")
  while html
    last = html
    chars = true
    if html[0] == "<"
      if html[1] == "/"
        match = html.match(endTag)
        if match
          html = html.substring(match[0].length)
          match[0].replace endTag, parseEndTag
          chars = false
      else
        match = html.match(startTag)
        if match
          html = html.substring(match[0].length)
          match[0].replace startTag, parseStartTag
          chars = false
    if chars
      index = html.indexOf("<")
      text = (if index < 0 then html else html.substring(0, index))
      html = (if index < 0 then "" else html.substring(index))
      text = text.replace(endingSpace, "")
      charsHandler text  if text
    throw "Parse Error: " + html  if html == last
isArray = exports.isArray = Array.isArray or (obj) ->
  toString.call(obj) == "[object Array]"

isArguments = exports.isArguments = (obj) ->
  not not (obj and hasOwnProperty.call(obj, "callee"))

exports.isFunction = (obj) ->
  not not (obj and obj.constructor and obj.call and obj.apply)

exports.isString = (obj) ->
  not not (obj == "" or (obj and obj.charCodeAt and obj.substr))

exports.isNumber = (obj) ->
  not not (obj == 0 or (obj and obj.toExponential and obj.toFixed))

exports.isNaN = (obj) ->
  obj != obj

exports.isBoolean = (obj) ->
  obj == true or obj == false

exports.isDate = (obj) ->
  not not (obj and obj.getTimezoneOffset and obj.setUTCFullYear)

exports.isRegExp = (obj) ->
  not not (obj and obj.test and obj.exec and (obj.ignoreCase or obj.ignoreCase == false))

exports.isNull = (obj) ->
  obj == null

exports.isUndefined = (obj) ->
  obj == undefined

exports.isDefined = (obj) ->
  obj != undefined

exports.toArray = (iterable) ->
  return []  unless iterable
  return iterable.toArray()  if iterable.toArray
  return Array.slice.call(iterable)  if isArguments(iterable)
  return iterable  if isArray(iterable)
  forEach iterable, (key, value) ->
    value

exports.toNumber = (obj) ->
  obj - 0

exports.arrayMax = (array) ->
  Math.max.apply Math, array

exports.arrayMin = (array) ->
  Math.min.apply Math, array

exports.onServer = typeof window == "undefined"
exports.publicModel = (name) ->
  not /(^_)|(\._)/.test(name)

forEach = exports.forEach = (obj, iterator) ->
  for key of obj
    iterator key, obj[key]

_ = exports
if _.onServer
  exports.minify = (->
    store = {}
    uglify = require("uglify-js")
    (js, cache) ->
      return store[js]  if cache and store[js]
      js = js.replace(/_\.onServer/g, "false")
      ufuncs = uglify.uglify
      out = uglify.parser.parse(js)
      out = ufuncs.ast_mangle(out)
      out = ufuncs.ast_squeeze(out)
      out = ufuncs.gen_code(out)
      store[js] = out  if cache
      out
  )()
else
module.exports = (parentModule, parentExports) ->
  dom = exports.dom = require("./dom")
  Model = require("./Model")
  model = exports.model = new Model()
  view = exports.view = require("./view")
  _ = exports.utils = require("./utils")
  dom._link model, view
  model._link dom
  view._link dom, model
  if _.onServer
    parentExports.dom = dom
    parentExports.model = model
    parentExports.view = view
    parentModule.exports = (app, dbUrl) ->
      browserify = require("browserify")
      path = require("path")
      clientDir = path.dirname(parentModule.filename)
      js = browserify(
        base: clientDir
        require: "vers"
        staticRoot: path.dirname(clientDir)
        coffee: false
        builtins: false
        filter: _.minify
      )
      db = require("./db")(dbUrl, model, parentExports)
      io = require("socket.io")
      socket = io.listen(app, transports: [ "websocket", "xhr-polling" ])
      model._setDb db
      model._setSocket socket
      view._setClientName path.basename(parentModule.filename, ".js")
      view._setJsFile js.filename
      app.use js.middleware
      parentExports
  else
    parentModule.exports = (count, modelData, modelEvents, domEvents) ->
      io = require("./socket.io")
      socket = new io.Socket(null)
      model._setSocket socket
      view.init count
      model.init modelData, modelEvents
      dom.init domEvents
      parentExports
  exports
quoteAttr = (s) ->
  s = String((if s == null then "" else s)).replace(/"/g, "&quot;")
  (if s then (if /[ =]/.test(s) then "\"" + s + "\"" else s) else "\"\"")
parse = (template) ->
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
    (if (match) then 
      pre: match[1]
      escaped: match[2] == "{{"
      name: match[3]
      post: match[4]
     else null)
  stack = []
  events = []
  html = [ "" ]
  htmlIndex = 0
  elementParse = input: (attr, attrs, name) ->
    if attr == "value"
      method = "propPolite"
      setMethod = "set"
      if "silent" of attrs
        method = "prop"
        setMethod = "setSilent"
        delete attrs.silent
      events.push (data) ->
        domArgs = [ setMethod, data[name].model, attrs._id or attrs.id, "prop", "value" ]
        dom.events.bind "keyup", domArgs
        dom.events.bind "keydown", domArgs
    else
      method = "attr"
    method
  
  htmlParse = 
    start: (tag, attrs) ->
      _.forEach attrs, (key, value) ->
        if match = extractPlaceholder(value)
          name = match.name
          if _.isUndefined(attrs.id)
            attrs.id = ->
              attrs._id = uniqueId()
          method = (if (tag of elementParse) then elementParse[tag](key, attrs, name) else "attr")
          events.push (data) ->
            path = data[name].model
            model.events.bind path, [ attrs._id or attrs.id, method, key ]  if path
          
          attrs[key] = modelText(name, match.escaped, true)
      
      stack.push [ "start", tag, attrs ]
    
    chars: (text) ->
      if match = extractPlaceholder(text)
        name = match.name
        escaped = _.toNumber(match.escaped)
        pre = match.pre
        post = match.post
        stack.push [ "chars", pre ]  if pre
        stack.push [ "start", "span", {} ]  if pre or post
        text = modelText(name, escaped)
        last = stack[stack.length - 1]
        if last[0] == "start"
          attrs = last[2]
          if _.isUndefined(attrs.id)
            attrs.id = ->
              attrs._id = uniqueId()
          events.push (data) ->
            path = data[name].model
            viewFunc = data[name].view
            params = [ attrs._id or attrs.id, "html", escaped ]
            if path
              params.push viewFunc  if viewFunc
              model.events.bind path, params
      stack.push [ "chars", text ]  if text
      stack.push [ "end", "span" ]  if pre or post
      htmlParse.chars post  if post
    
    end: (tag) ->
      stack.push [ "end", tag ]
  
  htmlParser.parse template, htmlParse
  stack.forEach (item) ->
    pushValue = (value, quote) ->
      if _.isFunction(value)
        htmlIndex = html.push(value, "") - 1
      else
        html[htmlIndex] += (if quote then quoteAttr(value) else value)
    switch item[0]
      when "start"
        html[htmlIndex] += "<" + item[1]
        _.forEach item[2], (key, value) ->
          html[htmlIndex] += " " + key + "="
          pushValue value, true
        
        html[htmlIndex] += ">"
        return
      when "chars"
        pushValue item[1]
        return
      when "end"
        html[htmlIndex] += "</" + item[1] + ">"
  
  (data, obj) ->
    rendered = html.reduce((memo, item) ->
      memo + (if _.isFunction(item) then item(data) else item)
    , "")
    events.forEach (item) ->
      item data
    
    rendered
simpleView = (name) ->
  (datum) ->
    path = datum.model
    obj = (if path then model.get(path) else datum)
    text = (if datum.view then get(datum.view, obj) else obj)
    model.events.bind path, [ "__document", "prop", "title" ]  if name == "Title"  if path
    text
_ = require("./utils")
htmlParser = require("./htmlParser")
views = {}
loadFuncs = ""
exports._link = (d, m) ->
  dom = d
  model = m

exports._setClientName = (s) ->
  clientName = s

exports._setJsFile = (s) ->
  jsFile = s

uniqueId = exports.uniqueId = ->
  "_" + (uniqueId._count++).toString(36)

uniqueId._count = 0
get = exports._get = (view, obj) ->
  view = views[view]
  (if (view) then (if _.isArray(obj) then obj.reduce((memo, item) ->
    memo + view(item)
  , "") else view(obj)) else "")

htmlEscape = exports.htmlEscape = (s) ->
  s = String((if s == null then "" else s))
  s.replace /[&<>]/g, (s) ->
    switch s
      when "&"
        "&amp;"
      when "<"
        "&lt;"
      when ">"
        "&gt;"
      else
        s

preLoad = exports.preLoad = (func) ->
  loadFuncs += "(" + func.toString() + ")();"

exports.make = (name, data, template, options) ->
  after = options and options.after
  render = ->
    render = (if (template) then parse(template) else simpleView(name))
    render.apply null, arguments
  
  func = (if _.isFunction(data) then ->
    render data.apply(null, arguments)
   else ->
    render data
  )
  if _.onServer
    preLoad after  if after
    views[name] = func
  else
    views[name] = (if (after) then ->
      setTimeout after, 0
      func.apply null, arguments
     else func)

if _.onServer
  exports.html = ->
    model.events._names = {}
    dom.events._names = {}
    uniqueId._count = 0
    title = get("Title")
    head = get("Head")
    body = get("Body")
    foot = get("Foot")
    "<!DOCTYPE html>" + "<title>" + title + "</title>" + head + body + "<script>function $(s){return document.getElementById(s)}" + _.minify(loadFuncs, true) + "</script>" + "<script src=" + jsFile + "></script>" + "<script>var " + clientName + "=require(\"./" + clientName + "\")(" + uniqueId._count + "," + JSON.stringify(model.get()).replace(/<\//g, "<\\/") + "," + JSON.stringify(model.events.get()) + "," + JSON.stringify(dom.events.get()) + ");</script>" + foot
else
  
exports.init = (count) ->
  uniqueId._count = count
