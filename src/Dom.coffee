EventDispatcher = require './EventDispatcher'
{htmlEscape} = require './View'

elements =
  $win: win = typeof window is 'object' && window
  $doc: doc = win.document

emptyEl = doc && doc.createElement 'div'

element = (id) -> elements[id] || (elements[id] = doc.getElementById id)

empty = ->
getMethods = 
  attr: (el, attr) -> el.getAttribute attr

  prop: getProp = (el, prop) -> el[prop]

  propPolite: getProp

  visible: empty

  displayed: empty

  html: (el) -> el.innerHTML

  appendHtml: empty

setMethods = 
  attr: (value, el, attr) ->
    el.setAttribute attr, value

  prop: (value, el, prop) ->
    el[prop] = value

  propPolite: (value, el, prop) ->
    el[prop] = value  if el != doc.activeElement

  visible: (value, el) ->
    el.style.visibility = if value then '' else 'hidden'

  displayed: (value, el) ->
    el.style.display = if value then '' else 'none'

  html: (value, el, escape) ->
    el.innerHTML = if escape then htmlEscape value else value

  appendHtml: (value, el) ->
    emptyEl.innerHTML = value
    while child = emptyEl.firstChild
      el.appendChild child

    
addListener = domHandler = empty

dist = (e) -> for child in e.target.childNodes
  return  unless child.nodeType == 1
  childEvent = Object.create e
  childEvent.target = child
  domHandler childEvent
  dist childEvent
distribute = (e) ->
  # Clone the event object first, since the e.target property is read only
  clone = {}
  for key, value of e
    clone[key] = value
  dist clone

Dom = module.exports = (model, appExports, @history) ->
  @events = events = new EventDispatcher
    onBind: (name) -> addListener doc, name  unless name of events._names
    onTrigger: (name, listener, targetId, e) ->
      if listener.length <= 3
        [fn, id, delay] = listener
        callback = if fn is '$dist' then distribute else appExports[fn]
        return  unless callback
      else
        [path, id, method, property, delay] = listener
        path = path.substr 1  if invert = path.charAt(0) is '!'

      return  unless id is targetId
      # Remove this listener if the element doesn't exist
      return false  unless el = element id

      # Update the model when the element's value changes
      finish = ->
        value = getMethods[method] el, property
        value = !value  if invert
        return  if model.get(path) == value
        model.set path, value

      if delay?
        setTimeout callback || finish, delay, e
      else
        (callback || finish) e
      return

  return

Dom:: =
  init: (domEvents) ->
    events = @events
    history = @history

    domHandler = (e) ->
      target = e.target
      target = target.parentNode  if target.nodeType == 3
      events.trigger e.type, target.id, e
    
    if doc.addEventListener
      @addListener = addListener = (el, name, cb, captures = false) ->
        el.addEventListener name, cb, captures
    else if doc.attachEvent
      @addListener = addListener = (el, name, cb) ->
        el.attachEvent 'on' + name, ->
          event.target || event.target = event.srcElement
          cb event
    
    events.set domEvents
    addListener doc, name, domHandler for name of events._names

    addListener doc, 'click', (e) ->
      # Detect clicks on links
      # Ignore command click, control click, and middle click
      if e.target.href && !e.metaKey && e.which == 1
        history._onClickLink e

    addListener doc, 'submit', (e) ->
      if e.target.tagName.toLowerCase() is 'form'
        history._onSubmitForm e

    addListener win, 'popstate', (e) ->
      history._onPop e

  update: (id, method, property, value, type, local) ->
    return false  unless el = element id
    
    if type is 'push' && method is 'html'
      method = 'appendHtml'  
    else if method is 'propPolite' && local
      method = 'prop'
    
    return  if value == getMethods[method] el, property
    setMethods[method] value, el, property
    return

Dom.getMethods = getMethods
Dom.setMethods = setMethods

