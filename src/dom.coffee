_ = require './utils'
EventDispatcher = require './EventDispatcher'

element = (id) -> elements[id] or (elements[id] = doc.getElementById(id))

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


win = !_.onServer && window
doc = win && win.document
emptyEl = if doc then doc.createElement('div') else null
elements =
  __document: doc
  __window: win

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
  return false  unless el = element id
  s = if viewFunc then view._get(viewFunc, value) else value
  setMethods[method] s, el, property

events = exports.events = new EventDispatcher onTrigger, onBind

if doc.addEventListener
  addListener = (name) ->
    doc.addEventListener name, domHandler, false
  removeListener = (name) ->
    doc.removeEventListener name, domHandler, false
else if doc.attachEvent
  addListener = (name) ->
    doc.attachEvent 'on' + name, domHandler
  removeListener = (name) ->
    doc.detachEvent 'on' + name, domHandler
else
  addListener = removeListener = ->

exports.addListener = addListener
exports.removeListener = removeListener
exports.init = (domEvents) ->
  events.set domEvents
  Object.keys(events._names).forEach addListener

