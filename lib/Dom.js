var racer = require('racer')
  , domShim = require('dom-shim')
  , EventDispatcher = require('./EventDispatcher')
  , escapeHtml = require('html-util').escapeHtml
  , merge = racer.util.merge
  , win = window
  , doc = document
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

  var events = this._events = new EventDispatcher({
    onTrigger: onTrigger
  , onBind: function(name, listener, eventName) {
      if (!listenerAdded[eventName]) {
        addListener(doc, eventName, trigger, true);
        listenerAdded[eventName] = true;
      }
    }
  });

  var captureEvents = this._captureEvents = new EventDispatcher({
    onTrigger: function(name, listener, e) {
      var id = listener.id
        , el = doc.getElementById(id);

      // Remove listener if element isn't found
      if (!el) return false;

      if (el.tagName === 'HTML' || el.contains(e.target)) {
        onTrigger(name, listener, id, e, el);
      }
    }
  , onBind: function(name, listener) {
      if (!captureListenerAdded[name]) {
        addListener(doc, name, captureTrigger, true);
        captureListenerAdded[name] = true;
      }
    }
  });

  function onTrigger(name, listener, id, e, el, next) {
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

  function trigger(e, el, noBubble, continued) {
    if (!el) el = e.target;
    var prefix = e.type + ':'
      , id;

    // Next can be called from a listener to continue bubbling
    function next() {
      trigger(e, el.parentNode, false, true);
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

  this.trigger = trigger;
  this.captureTrigger = captureTrigger;
  this.addListener = addListener;
  this.removeListener = removeListener;

  this._componentListeners = [];
  this._pendingUpdates = [];
}

Dom.prototype = {
  clear: function() {
    this._events.clear();
    this._captureEvents.clear();
    var listeners = this._componentListeners
      , i, listener;
    for (i = listeners.length; i--;) {
      listener = listeners[i];
      removeListener(listener[0], listener[1], listener[2], listener[3]);
    }
    this._componentListeners = [];
    markers = {};
  }

, bind: function(eventName, id, listener) {
    if (listener.capture) {
      listener.id = id;
      this._captureEvents.bind(eventName, listener);
    } else {
      this._events.bind("" + eventName + ":" + id, listener, eventName);
    }
  }

, update: function(el, method, ignore, value, property, index) {
    // Set to true during rendering
    if (this._preventUpdates) return;

    // Don't do anything if the element is already up to date
    if (value === this.getMethods[method](el, property)) return;
    this.setMethods[method](el, ignore, value, property, index);

    this._emitUpdate();
  }

, item: function(id) {
    return doc.getElementById(id) || elements[id] || getRange(id);
  }

, componentDom: function(ctx) {
  var componentListeners = this._componentListeners
    , dom = Object.create(this);

  dom.addListener = function(el, name, callback, captures) {
    componentListeners.push(arguments);
    addListener(el, name, callback, captures);
  };

  dom.element = function(name) {
    var id = ctx.$elements[name];
    return document.getElementById(id);
  };

  return dom;
}

, nextUpdate: function(callback) {
  this._pendingUpdates.push(callback);
}

, _emitUpdate: function() {
  var fns = this._pendingUpdates
    , len = fns.length
    , i;
  if (!len) return;
  this._pendingUpdates = [];
  for (i = 0; i < len; i++) {
    fns[i]();
  }
}

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

function getRange(name) {
  var start = markers[name]
    , end = markers['$' + name]
    , comment, commentIterator, range;

  if (!(start && end)) {
    // NodeFilter.SHOW_COMMENT == 128
    commentIterator = doc.createTreeWalker(doc.body, 128, null, false);
    while (comment = commentIterator.nextNode()) {
      markers[comment.data] = comment;
    }
    start = markers[name];
    end = markers['$' + name];
    if (!(start && end)) return;
  }

  // Comment nodes may continue to exist even if they have been removed from
  // the page. Thus, make sure they are still somewhere in the page body
  if (!doc.contains(start)) {
    delete markers[name];
    delete markers['$' + name];
    return;
  }
  range = doc.createRange();
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
