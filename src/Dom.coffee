{merge} = require('racer').util
EventDispatcher = require './EventDispatcher'
{escapeHtml} = require './html'

Dom = module.exports = (model, appExports) ->
  dom = this

  @events = events = new EventDispatcher
    onBind: (name, listener) ->
      if listener.length > 3
        listener[0] = model.__pathMap.id listener[0]
      unless name of events._names
        # Note that capturing is used so that blur and focus can be delegated
        # http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
        addListener doc, name, domHandler, true
      return name
    onTrigger: (name, listener, targetId, e) ->
      id = listener[1]
      return  unless id is targetId
      # Remove this listener if the element doesn't exist
      return false  unless el = element id

      if listener.length <= 3
        [fn, id, delay] = listener
        callback = fns[fn] || appExports[fn]
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
        setTimeout callback || finish, delay, e, dom
      else
        (callback || finish) e, dom
      return

  @domHandler = domHandler = (e) ->
    target = e.target
    target = target.parentNode  if target.nodeType == 3  # Node.TEXT_NODE
    events.trigger e.type, target.id, e

  if doc.addEventListener
    addListener = (el, name, cb, captures = false) ->
      el.addEventListener name, cb, captures
    removeListener = (el, name, cb, captures = false) ->
      el.removeEventListener name, cb, captures

  else if doc.attachEvent
    addListener = (el, name, cb) ->
      el.attachEvent 'on' + name, ->
        event.target || event.target = event.srcElement
        cb event
    removeListener = ->
      throw new Error 'Not implemented'

  @addListener = addListener
  @removeListener = removeListener

  return

Dom:: =

  clear: ->
    @events.clear()
    clearElements()

  update: (id, method, ignore, value, property, index) ->
    # Fail and remove the listener if the element can't be found
    return false  unless el = element id

    # Don't do anything if the element is already up to date
    return  if value == getMethods[method] el, property

    setMethods[method] el, ignore, value, property, index
    return

  getMethods: getMethods =
    attr: (el, attr) -> el.getAttribute attr
    prop: getProp = (el, prop) -> el[prop]
    propPolite: getProp
    html: (el) -> el.innerHTML
    # These methods return NaN, because it never equals anything else. Thus,
    # when compared against the new value, the new value will always be set
    visible: getNaN = -> NaN
    displayed: getNaN
    append: getNaN
    insert: getNaN
    remove: getNaN
    move: getNaN

  setMethods: setMethods =
    attr: (el, ignore, value, attr) ->
      return if ignore && el.id == ignore
      el.setAttribute attr, value
      return

    prop: (el, ignore, value, prop) ->
      return if ignore && el.id == ignore
      el[prop] = value
      return

    propPolite: (el, ignore, value, prop) ->
      return if ignore && el.id == ignore
      if el != doc.activeElement || !doc.hasFocus()
        el[prop] = value
      return

    visible: (el, ignore, value) ->
      return if ignore && el.id == ignore
      el.style.visibility = if value then '' else 'hidden'
      return

    displayed: (el, ignore, value) ->
      return if ignore && el.id == ignore
      el.style.display = if value then '' else 'none'
      return

    html: (obj, ignore, value, escape) ->
      value = escapeHtml value  if escape
      if obj.nodeType
        # Element
        return if ignore && obj.id == ignore
        obj.innerHTML = value
      else
        # Range
        obj.deleteContents()
        obj.insertNode obj.createContextualFragment value
      return

    append: (obj, ignore, value, escape) ->
      value = escapeHtml value  if escape
      if obj.nodeType
        # Element
        obj.insertAdjacentHTML 'beforeend', value
      else
        # Range
        el = obj.endContainer
        ref = el.childNodes[obj.endOffset]
        el.insertBefore obj.createContextualFragment(value), ref
      return

    insert: (obj, ignore, value, escape, index) ->
      value = escapeHtml value  if escape
      if obj.nodeType
        # Element
        if ref = obj.childNodes[index]
          ref.insertAdjacentHTML 'beforebegin', value
        else
          obj.insertAdjacentHTML 'beforeend', value
      else
        # Range
        el = obj.startContainer
        ref = el.childNodes[obj.startOffset + index]
        el.insertBefore obj.createContextualFragment(value), ref
      return

    remove: (el, ignore, index) ->
      if !el.nodeType
        # Range
        index += el.startOffset
        el = el.startContainer
      
      child = el.childNodes[index]
      el.removeChild child if child
      return

    move: (el, ignore, from, to, howMany) ->
      if !el.nodeType
        # Range
        offset = el.startOffset
        from += offset
        to += offset
        el = el.startContainer

      child = el.childNodes[from]
      # Don't move if the item at the destination is passed as the ignore
      # option, since this indicates the intended item was already moved
      # Also don't move if the child to move matches the ignore option
      return if !child || ignore &&
        (toEl = el.childNodes[to]) && toEl.id == ignore || child.id == ignore
      ref = el.childNodes[if to > from then to + howMany else to]
      
      if howMany > 1
        fragment = document.createDocumentFragment()
        while howMany--
          nextChild = child.nextSibling
          fragment.appendChild child
          break unless child = nextChild
        el.insertBefore fragment, ref
        return
      
      el.insertBefore child, ref
      return

  isEvent: isEvent = (obj) -> toString.call(obj) == '[object Event]'

  fns: fns =
    $forChildren: (e, dom) ->
      # Clone the event object first, since the e.target property is read only
      forChildren merge({}, e), dom.domHandler

    $forName: (e, dom) ->
      # Prevent infinte emission
      return unless isEvent(e)

      target = e.target
      return unless name = target.getAttribute 'name'
      elements = doc.getElementsByName name
      return unless elements.length > 1
      # Clone the event object first, since the e.target property is read only
      clone = merge {}, e
      domHandler = dom.domHandler
      for el in elements
        continue if el is target
        elEvent = Object.create clone
        elEvent.target = el
        domHandler elEvent
      return


toString = Object::toString
win = window
doc = win.document

elements = markers = null
do clearElements = ->
  elements =
    $win: win
    $doc: doc
  markers = {}

# TODO: Also implement with body.compare for IE
inPage = (node) -> doc.body.compareDocumentPosition(node) & 16

getRange = (name) ->
  start = markers[name]
  end = markers['$' + name]
  unless start && end
    # NodeFilter.SHOW_COMMENT == 128
    commentIterator = doc.createTreeWalker doc.body, 128, null, false
    while comment = commentIterator.nextNode()
      markers[comment.data] = comment
    start = markers[name]
    end = markers['$' + name]
    return unless start && end

  # Comment nodes may continue to exist even if they have been removed from
  # the page. Thus, make sure they are still somewhere in the page body.
  unless inPage start
    delete markers[name]
    delete markers['$' + name]
    return
  range = doc.createRange()
  range.setStartAfter start
  range.setEndBefore end
  return range

element = (id) ->
  elements[id] || (elements[id] = doc.getElementById(id)) || getRange(id)

forChildren = (e, domHandler) ->
  for child in e.target.childNodes
    return unless child.nodeType == 1  # Node.ELEMENT_NODE
    childEvent = Object.create e
    childEvent.target = child
    domHandler childEvent
    forChildren childEvent, domHandler
  return

# Add support for insertAdjacentHTML for Firefox < 8
# Based on insertAdjacentHTML.js by Eli Grey, http://eligrey.com
unless doc.body.insertAdjacentHTML
  HTMLElement::insertAdjacentHTML = (position, html) ->
    ref = this
    parent = ref.parentNode
    container = doc.createElement parent.tagName
    container.innerHTML = html
    switch position.toLowerCase()
      when 'beforeend'
        while node = container.firstChild
          ref.appendChild node
        return
      when 'beforebegin'
        while node = container.firstChild
          parent.insertBefore node, ref
        return
      when 'afterend'
        nextSibling = ref.nextSibling
        while node = container.lastChild
          nextSibling = parent.insertBefore node, nextSibling
        return
      when 'afterbegin'
        firstChild = ref.firstChild
        while node = container.lastChild
          firstChild = ref.insertBefore node, firstChild
        return
