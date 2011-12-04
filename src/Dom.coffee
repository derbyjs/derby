EventDispatcher = require './EventDispatcher'
{htmlEscape} = require './html'

win = typeof window is 'object' && window
doc = win.document
emptyEl = doc && doc.createElement 'div'

elements = null
element = (id) -> elements[id] || (elements[id] = doc.getElementById id)
clearElements = ->
  elements =
    $win: win
    $doc: doc

getNaN = -> NaN
getMethods = 
  attr: (el, attr) -> el.getAttribute attr

  prop: getProp = (el, prop) -> el[prop]

  propPolite: getProp

  html: (el) -> el.innerHTML

  # These methods return NaN, because it never equals anything else. Thus,
  # when compared against the new value, the new value will always be set
  visible: getNaN
  displayed: getNaN
  append: getNaN
  insert: getNaN
  remove: getNaN
  move: getNaN

# TODO: Implement ignore for every method

setMethods = 
  attr: (el, ignore, value, attr) ->
    return if ignore && el.id == ignore
    el.setAttribute attr, value

  prop: (el, ignore, value, prop) ->
    return if ignore && el.id == ignore
    el[prop] = value

  propPolite: (el, ignore, value, prop) ->
    return if ignore && el.id == ignore
    el[prop] = value  if el != doc.activeElement

  visible: (el, ignore, value) ->
    return if ignore && el.id == ignore
    el.style.visibility = if value then '' else 'hidden'

  displayed: (el, ignore, value) ->
    return if ignore && el.id == ignore
    el.style.display = if value then '' else 'none'

  html: html = (el, ignore, value, escape) ->
    return if ignore && el.id == ignore
    el.innerHTML = if escape then htmlEscape value else value

  append: (el, ignore, value, escape) ->
    html emptyEl, null, value, escape
    while child = emptyEl.firstChild
      el.appendChild child
    return

  insert: (el, ignore, value, escape, index) ->
    ref = el.childNodes[index]
    html emptyEl, null, value, escape
    while child = emptyEl.firstChild
      el.insertBefore child, ref
    return

  remove: (el, ignore, index) ->
    child = el.childNodes[index]
    el.removeChild child
  
  move: (el, ignore, from, to) ->
    # Don't move if the item at the destination is passed as the ignore option,
    # since this indicates the intended item was already moved
    if toEl = el.childNodes[to]
      return if ignore && toEl.id == ignore
    # Also don't move if the child to move matches the ignore option
    child = el.childNodes[from]
    return if ignore && child.id == ignore
    ref = el.childNodes[if to > from then to + 1 else to]
    el.insertBefore child, ref


addListener = domHandler = ->

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
    onBind: (name, listener) ->
      if listener.length > 3
        listener[0] = model.__pathMap.id listener[0]
      addListener doc, name  unless name of events._names
      return name
    onTrigger: (name, listener, targetId, e) ->
      id = listener[1]
      return  unless id is targetId
      # Remove this listener if the element doesn't exist
      return false  unless el = element id

      if listener.length <= 3
        [fn, id, delay] = listener
        callback = if fn is '$dist' then distribute else appExports[fn]
        return  unless callback
      else
        [pathId, id, method, property, delay, invert] = listener
        # Remove this listener if its path id is no longer registered
        return false  unless path = model.__pathMap.paths[pathId]

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
  clear: ->
    @events.clear()
    clearElements()

  init: ->
    events = @events
    history = @history
    clearElements()

    domHandler = (e) ->
      target = e.target
      target = target.parentNode  if target.nodeType == 3
      events.trigger e.type, target.id, e

    if doc.addEventListener
      @addListener = addListener = (el, name, cb = domHandler, captures = false) ->
        el.addEventListener name, cb, captures
    else if doc.attachEvent
      @addListener = addListener = (el, name, cb = domHandler) ->
        el.attachEvent 'on' + name, ->
          event.target || event.target = event.srcElement
          cb event

    addListener doc, name for name of events._names

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

  update: (id, method, ignore, value, property, index) ->
    # Fail and remove the listener if the element can't be found
    return false  unless el = element id

    # Don't do anything if the element is already up to date
    return  if value == getMethods[method] el, property

    setMethods[method] el, ignore, value, property, index
    return

Dom.getMethods = getMethods
Dom.setMethods = setMethods
