racer = require 'racer'
{lookup} = require 'racer/lib/path'
EventDispatcher = require './EventDispatcher'
{escapeHtml} = require './html'
{merge} = racer.util

markers = {}
elements =
  $_win: win = window
  $_doc: doc = win.document

Dom = module.exports = (model, appExports) ->
  dom = this

  # Map dom event name -> true
  listenerAdded = {}
  captureListenerAdded = {}

  onTrigger = (name, listener, id, e, el, next) ->
    if (fn = listener.fn)?
      finish = fns[fn] || appExports[fn] || lookup(fn, appExports)
      return  unless finish
    else
      # Update the model when the element's value changes
      finish = ->
        value = getMethods[listener.method] el, listener.property

        if setValue = listener.setValue
          setValue model, value
          return

        # Remove this listener if its path id is no longer registered
        return false  unless path = model.__pathMap.paths[listener.pathId]
        # Set the value if changed
        return  if model.get(path) == value
        model.pass(e).set path, value

    if (delay = listener.delay)?
      setTimeout finish, delay, e, el, next, dom
    else
      finish e, el, next, dom
    return

  # DOM listener capturing allows blur and focus to be delegated
  # http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
  @_events = events = new EventDispatcher
    onTrigger: onTrigger

    onBind: (name, listener, eventName) ->
      unless listenerAdded[eventName]
        addListener doc, eventName, trigger, true
        listenerAdded[eventName] = true
      return

  @_captureEvents = captureEvents = new EventDispatcher
    onTrigger: (name, listener, e) ->
      id = listener.id
      el = doc.getElementById id
      if el.tagName is 'HTML' || el.contains e.target
        onTrigger name, listener, id, e, el
      return

    onBind: (name, listener) ->
      unless captureListenerAdded[name]
        addListener doc, name, captureTrigger, true
        captureListenerAdded[name] = true
      return

  @trigger = trigger = (e, el, noBubble, continued) ->
    prefix = e.type + ':'
    el ||= e.target
    # Next can be called from a listener to continue bubbling
    next = -> trigger e, el.parentNode, false, true
    next.firstTrigger = !continued

    if noBubble && id = el.id
      return events.trigger prefix + id, id, e, el, next

    while true
      while !(id = el.id)
        return unless el = el.parentNode
      # Stop bubbling once the event is handled
      return if events.trigger prefix + id, id, e, el, next
      return unless el = el.parentNode
    return

  @captureTrigger = captureTrigger = (e) ->
    captureEvents.trigger e.type, e

  @addListener = addListener
  @removeListener = removeListener

  return

Dom:: =

  clear: ->
    @_events.clear()
    @_captureEvents.clear()
    markers = {}

  bind: (eventName, id, listener) ->
    if listener.capture
      listener.id = id
      @_captureEvents.bind eventName, listener
    else
      @_events.bind "#{eventName}:#{id}", listener, eventName

  update: (el, method, ignore, value, property, index) ->
    # Don't do anything if the element is already up to date
    return if value == getMethods[method] el, property
    # Otherwise, apply the update
    setMethods[method] el, ignore, value, property, index

  item: (id) -> doc.getElementById(id) || elements[id] || getRange(id)

  getMethods: getMethods =
    attr: (el, attr) -> el.getAttribute attr
    prop: getProp = (el, prop) -> el[prop]
    propPolite: getProp
    html: (el) -> el.innerHTML
    # These methods return NaN, because it never equals anything else. Thus,
    # when compared against the new value, the new value will always be set
    append: getNaN = -> NaN
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
        obj.endOffset
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

  fns: fns =
    $forChildren: forChildren = (e, el, next, dom) ->
      # Prevent infinte emission
      return unless next.firstTrigger

      # Re-trigger the event on all child elements
      for child in el.childNodes
        continue if child.nodeType != 1  # Node.ELEMENT_NODE
        dom.trigger e, child, true, true
        forChildren e, child, next, dom
      return

    $forName: (e, el, next, dom) ->
      # Prevent infinte emission
      return unless next.firstTrigger

      # Re-trigger the event on all other elements with
      # the same 'name' attribute
      return unless name = el.getAttribute 'name'
      elements = doc.getElementsByName name
      return unless elements.length > 1
      for element in elements
        continue if element is el
        dom.trigger e, element, false, true
      return


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
  unless doc.body.contains start
    delete markers[name]
    delete markers['$' + name]
    return
  range = doc.createRange()
  range.setStartAfter start
  range.setEndBefore end
  return range

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

# Add support for Node.contains for Firefox < 9
unless doc.body.contains
  Node::contains = (node) ->
    !!(@compareDocumentPosition(node) & 16)

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
