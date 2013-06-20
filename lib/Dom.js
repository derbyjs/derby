var racer = require('racer')
  , domShim = require('dom-shim')
  , EventDispatcher = require('./EventDispatcher')
  , viewPath = require('./viewPath')
  , escapeHtml = require('html-util').escapeHtml
  , textOt = require('./textOt')
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

    e.path = function(name) {
      var path = model.__pathMap.paths[listener.pathId];
      if (!name) return path;
      viewPath.patchCtx(listener.ctx, path)
      return viewPath.ctxPath(listener.view, listener.ctx, name);
    };
    e.get = function(name) {
      var path = e.path(name);
      return viewPath.dataValue(listener.view, listener.ctx, model, path);
    };
    e.at = function(name) {
      return model.at(e.path(name));
    };

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

        var setterModel = model.pass({$e: e, $el: el});
        if (listener.method === 'propOt') {
          return textOt.onTextInput(setterModel, path, value);
        }
        setterModel.set(path, value);
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
, addListener: domAddListener
, removeListener: domRemoveListener
, addComponent: addComponent

, getMethods: {
    attr: getAttr
  , prop: getProp
  , propOt: getPropOt
  , stringInsert: getPropOt
  , stringRemove: getPropOt
  , html: getHtml
    // These methods return NaN, because it never equals anything else. Thus,
    // when compared against the new value, the new value will always be set
  , insert: getNaN
  , remove: getNaN
  , move: getNaN
  }

, setMethods: {
    attr: setAttr
  , prop: setProp
  , propOt: setPropOt
  , stringInsert: setStringInsert
  , stringRemove: setStringRemove
  , html: setHtml
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

function domListenerHash() {
  var out = {}
    , key
  for (key in this) {
    if (key === 'view' || key === 'ctx' || key === 'pathId') continue;
    out[key] = this[key];
  }
  return out;
}

function domBind(eventName, id, listener) {
  listener.toJSON = domListenerHash;
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

function domUpdate(el, method, ignore, value, property, index, arg) {
  // Wrapped in a try / catch so that errors thrown on DOM updates don't
  // stop subsequent code from running
  try {
    // Don't do anything if the element is already up to date
    if (value === this.getMethods[method](el, property)) return;
    this.setMethods[method](el, ignore, value, property, index, arg);
  } catch (err) {
    setTimeout(function() {
      throw err;
    }, 0);
  }
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
  return el.getAttribute && el.getAttribute(attr);
}
function getProp(el, prop) {
  return el[prop];
}
function getPropOt(el, prop) {
  // IE and Opera replace \n with \r\n
  var value = el[prop];
  return value && value.replace && value.replace(/\r\n/g, '\n');
}
function getHtml(el) {
  return el.innerHTML;
}
function getNaN() {
  return NaN;
}

function setAttr(el, ignore, value, attr) {
  el.setAttribute && el.setAttribute(attr, value);
}
function setProp(el, ignore, value, prop) {
  el[prop] = value;
}
function setPropOt(el, ignore, value, prop) {
  el[prop] = value;
}
function setStringInsert(el, ignore, value, prop, index, text) {
  var previous = getPropOt(el, prop);
  textOt.onStringInsert(el, previous, index, text);
}
function setStringRemove(el, ignore, value, prop, index, howMany) {
  var previous = getPropOt(el, prop);
  textOt.onStringRemove(el, previous, index, howMany);
}

function makeSVGFragment(fragment, svgElement) {
  // TODO: Allow optional namespace declarations
  var pre = '<svg xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink>' 
    , post = '</svg>'
    , range = document.createRange()
  range.selectNode(svgElement);
  return range.createContextualFragment(pre + fragment + post);
}
function appendSVG(element, fragment, svgElement) {
  var frag = makeSVGFragment(fragment, svgElement)
    , children = frag.childNodes[0].childNodes
    , i
  for (i = children.length; i--;) {
    element.appendChild(children[0]);
  }
}
function insertBeforeSVG(element, fragment, svgElement) {
  var frag = makeSVGFragment(fragment, svgElement)
    , children = frag.childNodes[0].childNodes
    , parent = element.parentNode
    , i
  for (i = children.length; i--;) {
    parent.insertBefore(children[0], element);
  }
}
function removeChildren(element) {
  var children = element.childNodes
    , i
  for (i = children.length; i--;) {
    element.removeChild(children[0]);
  }
}

function isSVG(obj) {
  return !!obj.ownerSVGElement || obj.tagName === "svg";
}
function svgRoot(obj) {
  return obj.ownerSVGElement || obj;
}
function isRange(obj) {
  return !!obj.cloneRange;
}

function setHtml(obj, ignore, value, escape) {
  if (escape) value = escapeHtml(value);
  if(isRange(obj)) {
    if(isSVG(obj.startContainer)) {
      // SVG Element
      obj.deleteContents();
      var svgElement = svgRoot(obj.startContainer);
      obj.insertNode(makeSVGFragment(value, svgElement));
      return;
    } else {
      // Range
      obj.deleteContents();
      obj.insertNode(obj.createContextualFragment(value));
      return;
    }
  }
  if (isSVG(obj)) {
    // SVG Element
    var svgElement = svgRoot(obj);
    removeChildren(obj);
    appendSVG(obj, value, svgElement);
    return;
  }
  // HTML Element
  if (ignore && obj.id === ignore) return;
  obj.innerHTML = value;
}
function setInsert(obj, ignore, value, escape, index) {
  if (escape) value = escapeHtml(value);
  if (obj.nodeType) {
    // Element
    if (ref = obj.childNodes[index]) {
      if (isSVG(obj)) {
        var svgElement = obj.ownerSVGElement || obj;
        insertBeforeSVG(ref, value, svgElement);
        return;
      }
      var range = document.createRange();
      range.selectNodeContents(obj);
      obj.insertBefore(range.createContextualFragment(value), ref);
    } else {
      if (isSVG(obj)) {
        var svgElement = obj.ownerSVGElement || obj;
        appendSVG(obj, value, svgElement);
        return;
      }
      var range = document.createRange();
      range.selectNodeContents(obj);
      obj.appendChild(range.createContextualFragment(value));
    }
  } else {
    // Range
    if (isSVG(obj.startContainer)) {
      var el = obj.startContainer
      , ref = el.childNodes[obj.startOffset + index];
      var svgElement = svgRoot(ref);
      el.insertBefore(makeSVGFragment(value, svgElement), ref)
    } else {
      var el = obj.startContainer
        , ref = el.childNodes[obj.startOffset + index];
      el.insertBefore(obj.createContextualFragment(value), ref);
    }
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
function setMove(el, ignore, from, property, to, howMany) {
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
    , commentIterator = doc.createTreeWalker(doc, 128, null, false)
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
