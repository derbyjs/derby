EventDispatcher = require './EventDispatcher'
View = require './View'

elements =
  $win: win = typeof window is 'object' && window
  $doc: doc = win.document

emptyEl = doc && doc.createElement 'div'

element = (id) -> elements[id] || (elements[id] = doc.getElementById id)


getMethods = 
  attr: (el, attr) -> el.getAttribute attr

  prop: (el, prop) -> el[prop]

  html: (el) -> el.innerHTML

setMethods = 
  attr: (value, el, attr) ->
    el.setAttribute attr, value

  prop: (value, el, prop) ->
    el[prop] = value

  propPolite: (value, el, prop) ->
    el[prop] = value  if el != doc.activeElement

  html: (value, el, escape) ->
    el.innerHTML = if escape then View.htmlEscape value else value

  appendHtml: (value, el) ->
    emptyEl.innerHTML = value
    while child = emptyEl.firstChild
      el.appendChild child


addListener = ->

Dom = module.exports = (model, appExports) ->
  @events = events = new EventDispatcher
    onBind: (name) -> addListener name  unless name of events._names
    onTrigger: (name, listener, targetId, e) ->
      if listener.length is 2
        [fn, id] = listener
        return  unless callback = appExports[fn]
      else
        [fn, path, id, method, property] = listener
      
      return  unless id is targetId
      # Remove this listener if the element doesn't exist
      return false  unless el = element id
      
      if callback then callback e; return
      
      # Update the model when the element's value changes
      last = el.$last
      el.$last = value = getMethods[method] el, property
      return  unless value != last
      model[fn] path, value

  return

Dom:: =
  init: (domEvents) ->
    events = @events
    domHandler = (e) ->
      target = e.target || e.srcElement
      target = target.parentNode  if target.nodeType == 3
      events.trigger e.type, target.id, e
    
    if doc.addEventListener
      addListener = (name) -> doc.addEventListener name, domHandler, false
    else if doc.attachEvent
      addListener = (name) -> doc.attachEvent 'on' + name, -> domHandler event
    
    events.set domEvents
    addListener name for name of events._names

  update: (id, method, property, value, type, local) ->
    return false  unless el = element id
    
    if type is 'push' && method is 'html'
      method = 'appendHtml'  
    else if method is 'propPolite' && local
      method = 'prop'
    setMethods[method] value, el, property

