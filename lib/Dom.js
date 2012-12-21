var racer = require('racer')
  , domShim = require('dom-shim')
  , EventDispatcher = require('./EventDispatcher')
  , escapeHtml = require('html-util').escapeHtml
  , merge = racer.util.merge
  , win = window
  , doc = win.document
  , markers = {}
  , elements = {
      $_win: win
    , $_doc: doc
    }
  , addListener, removeListener;

module.exports = Dom;

function Dom(model) {
  var dom = this
    , fns = this.fns

      // Map dom event name -> true
    , listenerAdded = {}
    , captureListenerAdded = {};

  // DOM listener capturing allows blur and focus to be delegated
  // http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
  var captureEvents = this._captureEvents = new EventDispatcher({
    onTrigger: onCaptureTrigger
  , onBind: onCaptureBind
  });
  function onCaptureTrigger(name, listener, e) {
    var id = listener.id
      , el = doc.getElementById(id);

    // Remove listener if element isn't found
    if (!el) return false;

    if (el.tagName === 'HTML' || el.contains(e.target)) {
      onDomTrigger(name, listener, id, e, el);
    }
  }
  function onCaptureBind(name, listener) {
    if (captureListenerAdded[name]) return;
    addListener(doc, name, captureTrigger, true);
    captureListenerAdded[name] = true;
  }

  var events = this._events = new EventDispatcher({
    onTrigger: onDomTrigger
  , onBind: onDomBind
  });
  function onDomTrigger(name, listener, id, e, el, next) {
    var delay = listener.delay
      , finish = listener.fn;

    if (!finish) {
      // Update the model when the element's value changes
      finish = function() {
        var value = dom.getMethods[listener.method](el, listener.property)
          , setValue = listener.setValue;

        // Allow the listener to override the setting function
        if (setValue) {
          setValue(model, value);
          return;
        }

        // Remove this listener if its path id is no longer registered
        var path = model.__pathMap.paths[listener.pathId];
        if (!path) return false;

        // Set the value if changed
        if (model.get(path) === value) return;
        model.pass(e).set(path, value);
      }
    }

    if (delay != null) {
      setTimeout(finish, delay, e, el, next, dom);
    } else {
      finish(e, el, next, dom);
    }
  }
  function onDomBind(name, listener, eventName) {
    if (listenerAdded[eventName]) return;
    addListener(doc, eventName, triggerDom, true);
    listenerAdded[eventName] = true;
  }

  function triggerDom(e, el, noBubble, continued) {
    if (!el) el = e.target;
    var prefix = e.type + ':'
      , id;

    // Next can be called from a listener to continue bubbling
    function next() {
      triggerDom(e, el.parentNode, false, true);
    }
    next.firstTrigger = !continued;
    if (noBubble && (id = el.id)) {
      return events.trigger(prefix + id, id, e, el, next);
    }
    while (true) {
      while (!(id = el.id)) {
        if (!(el = el.parentNode)) return;
      }
      // Stop bubbling once the event is handled
      if (events.trigger(prefix + id, id, e, el, next)) return;
      if (!(el = el.parentNode)) return;
    }
  }

  function captureTrigger(e) {
    captureEvents.trigger(e.type, e);
  }

  this.trigger = triggerDom;
  this.captureTrigger = captureTrigger;

  this._listeners = [];
  this._components = [];
  this._pendingUpdates = [];

  function componentCleanup() {
    var components = dom._components
      , map = getMarkers()
      , i, component
    for (i = components.length; i--;) {
      component = components[i];
      if (component && !getMarker(map, component.scope)) {
        component.emit('destroy');
      }
    }
  }
  // This cleanup listeners is placed at the beginning so that component
  // scopes are cleared before any ref cleanups are checked
  model.listeners('cleanup').unshift(componentCleanup);
}

Dom.prototype = {
  clear: domClear
, bind: domBind
, item: domItem
, marker: domMarker
, update: domUpdate
, nextUpdate: nextUpdate
, _emitUpdate: emitUpdate
, addListener: domAddListener
, removeListener: domRemoveListener
, addComponent: addComponent

, getMethods: {
    attr: getAttr
  , prop: getProp
  , propPolite: getProp
  , html: getHtml
    // These methods return NaN, because it never equals anything else. Thus,
    // when compared against the new value, the new value will always be set
  , append: getNaN
  , insert: getNaN
  , remove: getNaN
  , move: getNaN
  }

, setMethods: {
    attr: setAttr
  , prop: setProp
  , propPolite: setProp
  , html: setHtml
  , append: setAppend
  , insert: setInsert
  , remove: setRemove
  , move: setMove
  }

, fns: {
    $forChildren: forChildren
  , $forName: forName
  }
}

function domClear() {
  this._events.clear();
  this._captureEvents.clear();
  var components = this._components
    , listeners = this._listeners
    , i, component
  for (i = listeners.length; i--;) {
    removeListener.apply(null, listeners[i]);
  }
  this._listeners = [];
  for (i = components.length; i--;) {
    component = components[i];
    component && component.emit('destroy');
  }
  this._components = [];
  markers = {};
}

function domBind(eventName, id, listener) {
  if (listener.capture) {
    listener.id = id;
    this._captureEvents.bind(eventName, listener);
  } else {
    this._events.bind("" + eventName + ":" + id, listener, eventName);
  }
}

function domItem(id) {
  return doc.getElementById(id) || elements[id] || getRange(id);
}

function domUpdate(el, method, ignore, value, property, index) {
  // Set to true during rendering
  if (this._preventUpdates) return;

  // Wrapped in a try / catch so that errors thrown on DOM updates don't
  // stop subsequent code from running
  try {
    // Don't do anything if the element is already up to date
    if (value === this.getMethods[method](el, property)) return;
    this.setMethods[method](el, ignore, value, property, index);
    this._emitUpdate();
  } catch (err) {
    setTimeout(function() {
      throw err;
    }, 0);
  }
}
function nextUpdate(callback) {
  this._pendingUpdates.push(callback);
}
function emitUpdate() {
  var fns = this._pendingUpdates
    , len = fns.length
    , i;
  if (!len) return;
  this._pendingUpdates = [];
  // Give the browser a chance to render the page before initializing
  // components and other delayed updates
  setTimeout(function() {
    for (i = 0; i < len; i++) {
      fns[i]();
    }
  }, 0);
}

function domAddListener(el, name, callback, captures) {
  this._listeners.push([el, name, callback, captures]);
  addListener(el, name, callback, captures);
}
function domRemoveListener(el, name, callback, captures) {
  removeListener(el, name, callback, captures);
}

function addComponent(ctx, component) {
  var components = this._components
    , dom = component.dom = Object.create(this);

  components.push(component);
  component.on('destroy', function() {
    var index = components.indexOf(component);
    if (index === -1) return;
    // The components array gets replaced on a dom.clear, so we allow
    // it to get sparse as individual components are destroyed
    delete components[index];
  });

  dom.addListener = function(el, name, callback, captures) {
    component.on('destroy', function() {
      removeListener(el, name, callback, captures);
    });
    addListener(el, name, callback, captures);
  };

  dom.element = function(name) {
    var id = ctx.$elements[name];
    return document.getElementById(id);
  };

  return dom;
}


function getAttr(el, attr) {
  return el.getAttribute(attr);
}
function getProp(el, prop) {
  return el[prop];
}
function getHtml(el) {
  return el.innerHTML;
}
function getNaN() {
  return NaN;
}

function setAttr(el, ignore, value, attr) {
  if (ignore && el.id === ignore) return;
  el.setAttribute(attr, value);
}
function setProp(el, ignore, value, prop) {
  if (ignore && el.id === ignore) return;
  el[prop] = value;
}
function propPolite(el, ignore, value, prop) {
  if (ignore && el.id === ignore) return;
  if (el !== doc.activeElement || !doc.hasFocus()) {
    el[prop] = value;
  }
}
function setHtml(obj, ignore, value, escape) {
  if (escape) value = escapeHtml(value);
  if (obj.nodeType) {
    // Element
    if (ignore && obj.id === ignore) return;
    obj.innerHTML = value;
  } else {
    // Range
    obj.deleteContents();
    obj.insertNode(obj.createContextualFragment(value));
  }
}
function setAppend(obj, ignore, value, escape) {
  if (escape) value = escapeHtml(value);
  if (obj.nodeType) {
    // Element
    obj.insertAdjacentHTML('beforeend', value);
  } else {
    // Range
    var el = obj.endContainer
      , ref = el.childNodes[obj.endOffset];
    el.insertBefore(obj.createContextualFragment(value), ref);
  }
}
function setInsert(obj, ignore, value, escape, index) {
  if (escape) value = escapeHtml(value);
  if (obj.nodeType) {
    // Element
    if (ref = obj.childNodes[index]) {
      ref.insertAdjacentHTML('beforebegin', value);
    } else {
      obj.insertAdjacentHTML('beforeend', value);
    }
  } else {
    // Range
    var el = obj.startContainer
      , ref = el.childNodes[obj.startOffset + index];
    el.insertBefore(obj.createContextualFragment(value), ref);
  }
}
function setRemove(el, ignore, index) {
  if (!el.nodeType) {
    // Range
    index += el.startOffset;
    el = el.startContainer;
  }
  var child = el.childNodes[index];
  if (child) el.removeChild(child);
}
function setMove(el, ignore, from, to, howMany) {
  var child, fragment, nextChild, offset, ref, toEl;
  if (!el.nodeType) {
    offset = el.startOffset;
    from += offset;
    to += offset;
    el = el.startContainer;
  }
  child = el.childNodes[from];

  // Don't move if the item at the destination is passed as the ignore
  // option, since this indicates the intended item was already moved
  // Also don't move if the child to move matches the ignore option
  if (!child || ignore && (toEl = el.childNodes[to]) &&
      toEl.id === ignore || child.id === ignore) return;

  ref = el.childNodes[to > from ? to + howMany : to];
  if (howMany > 1) {
    fragment = document.createDocumentFragment();
    while (howMany--) {
      nextChild = child.nextSibling;
      fragment.appendChild(child);
      if (!(child = nextChild)) break;
    }
    el.insertBefore(fragment, ref);
    return;
  }
  el.insertBefore(child, ref);
}

function forChildren(e, el, next, dom) {
  // Prevent infinte emission
  if (!next.firstTrigger) return;

  // Re-trigger the event on all child elements
  var children = el.childNodes;
  for (var i = 0, len = children.length, child; i < len; i++) {
    child = children[i];
    if (child.nodeType !== 1) continue;  // Node.ELEMENT_NODE
    dom.trigger(e, child, true, true);
    forChildren(e, child, next, dom);
  }
}

function forName(e, el, next, dom) {
  // Prevent infinte emission
  if (!next.firstTrigger) return;

  var name = el.getAttribute('name');
  if (!name) return;

  // Re-trigger the event on all other elements with
  // the same 'name' attribute
  var elements = doc.getElementsByName(name)
    , len = elements.length;
  if (!(len > 1)) return;
  for (var i = 0, element; i < len; i++) {
    element = elements[i];
    if (element === el) continue;
    dom.trigger(e, element, false, true);
  }
}

function getMarkers() {
  var map = {}
      // NodeFilter.SHOW_COMMENT == 128
    , commentIterator = doc.createTreeWalker(doc.body, 128, null, false)
    , comment
  while (comment = commentIterator.nextNode()) {
    map[comment.data] = comment;
  }
  return map;
}

function getMarker(map, name) {
  var marker = map[name];
  if (!marker) return;

  // Comment nodes may continue to exist even if they have been removed from
  // the page. Thus, make sure they are still somewhere in the page body
  if (!doc.contains(marker)) {
    delete map[name];
    return;
  }
  return marker;
}

function domMarker(name) {
  var marker = getMarker(markers, name);
  if (!marker) {
    markers = getMarkers();
    marker = getMarker(markers, name);
    if (!marker) return;
  }
  return marker;
}

function getRange(name) {
  var start = domMarker(name);
  if (!start) return;
  var end = domMarker('$' + name);
  if (!end) return;

  var range = doc.createRange();
  range.setStartAfter(start);
  range.setEndBefore(end);
  return range;
}

if (doc.addEventListener) {
  addListener = function(el, name, callback, captures) {
    el.addEventListener(name, callback, captures || false);
  };
  removeListener = function(el, name, callback, captures) {
    el.removeEventListener(name, callback, captures || false);
  };

} else if (doc.attachEvent) {
  addListener = function(el, name, callback) {
    function listener() {
      if (!event.target) event.target = event.srcElement;
      callback(event);
    }
    callback.$derbyListener = listener;
    el.attachEvent('on' + name, listener);
  };
  removeListener = function(el, name, callback) {
    el.detachEvent('on' + name, callback.$derbyListener);
  };
}
