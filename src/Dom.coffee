EventDispatcher = require './EventDispatcher'
View = require './View'

elements =
  __window: win = typeof window is 'object' && window
  __document: doc = win.document

emptyEl = doc && doc.createElement 'div'

element = (id) -> elements[id] || (elements[id] = doc.getElementById id)


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
    if Array.isArray props
      last = props.length - 1
      i = 0
      while i < last
        el = el[props[i++]]
      prop = props[last]
    else
      prop = props
    el[prop] = value
  
  propPolite: (value, el, prop) ->
    el[prop] = value  if el != doc.activeElement
  
  html: (value, el, escape) ->
    el.innerHTML = if escape then View.htmlEscape value else value
  
  appendHtml: (value, el) ->
    emptyEl.innerHTML = value
    while child = emptyEl.firstChild
      el.appendChild child


domHandler = (e) ->
  target = e.target || e.srcElement
  target = target.parentNode  if target.nodeType == 3
  events.trigger e.type, target.id

if doc.addEventListener
  addListener = (name) ->
    doc.addEventListener name, domHandler, false
  removeListener = (name) ->
    doc.removeEventListener name, domHandler, false
else if doc.attachEvent
  addListener = (name) ->
    doc.attachEvent 'on' + name, -> domHandler event
  removeListener = (name) ->
    doc.detachEvent 'on' + name, domHandler
else
  addListener = removeListener = ->


Dom = module.exports = (model) ->
  @events = events = new EventDispatcher
    onBind: (name) -> addListener name  unless name of events._names
    onTrigger: (name, listener, targetId) ->
      [fn, path, id, method, property] = listener
      return  unless id is targetId
      # Remove this listener if the element doesn't exist
      return false  unless el = element id
      value = getMethods[method] el, property
      model[fn] path, value

  return

Dom:: =
  init: (domEvents) ->
    @events.set domEvents
    addListener name for name in @events._names

  update: (id, method, property, value) ->
    return false  unless el = element id
    setMethods[method] s, el, property


#    s = if viewFunc then @view._get(viewFunc, value) else value

