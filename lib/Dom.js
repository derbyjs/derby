var templates = require('derby-templates').templates;
var elementAddDestroyListener = templates.elementAddDestroyListener;
var elementRemoveDestroyListener = templates.elementRemoveDestroyListener;

module.exports = Dom;

function Dom(controller) {
  this.controller = controller;
  this._listeners = null;
}

Dom.prototype._initListeners = function() {
  var dom = this;
  this.controller.on('destroy', function domOnDestroy() {
    var listeners = dom._listeners;
    if (!listeners) return;
    dom._listeners = null;
    for (var i = listeners.length; i--;) {
      listeners[i].remove();
    }
  });
  return this._listeners = [];
};

Dom.prototype._listenerIndex = function(type, target, listener, useCapture) {
  var listeners = this._listeners;
  if (!listeners) return -1;
  for (var i = listeners.length; i--;) {
    if (listeners[i].matches(type, target, listener, useCapture)) return i;
  }
  return -1;
};

Dom.prototype.addListener = function(type, target, listener, useCapture) {
  if (typeof target === 'function') {
    useCapture = listener;
    listener = target;
    target = document;
  }
  useCapture = !!useCapture;
  // Don't add the same listener function with matching options twice
  var i = this._listenerIndex(type, target, listener, useCapture);
  if (i > -1) return;
  // Create the listener object and add to its target
  var domListener =
    (type === 'destroy') ? new DestroyListener(target, listener) :
    new DomListener(this, type, target, listener, useCapture);
  var listeners = this._listeners || this._initListeners();
  listeners.push(domListener);
  domListener.add();
};
Dom.prototype.on = Dom.prototype.addListener;

Dom.prototype.once = function(type, target, listener, useCapture) {
  if (typeof target === 'function') {
    useCapture = listener;
    listener = target;
    target = document;
  }
  useCapture = !!useCapture;
  this.addListener(type, target, wrappedListener, useCapture);
  var dom = this;
  function wrappedListener() {
    dom.removeListener(type, target, wrappedListener, useCapture);
    return listener.apply(this, arguments);
  }
};

Dom.prototype.removeListener = function(type, target, listener, useCapture) {
  if (typeof target === 'function') {
    useCapture = listener;
    listener = target;
    target = document;
  }
  useCapture = !!useCapture;
  var i = this._listenerIndex(type, target, listener, useCapture);
  if (i > -1) {
    var removed = this._listeners.splice(i, 1);
    removed[0].remove();
  }
};

function elementAddListener(target, type, listener, useCapture) {
  target.addEventListener(type, listener, useCapture);
}
function elementRemoveListener(target, type, listener, useCapture) {
  target.removeEventListener(type, listener, useCapture);
}

function DomListener(dom, type, target, listener, useCapture) {
  this.dom = dom;
  this.type = type;
  this.target = target;
  this.listener = listener;
  this.useCapture = useCapture;
  this.destroyListener = null;
}
DomListener.prototype.matches = function(type, target, listener, useCapture) {
  return this.listener === listener &&
    this.target === target &&
    this.type === type &&
    this.useCapture === useCapture;
};
DomListener.prototype.add = function() {
  elementAddListener(this.target, this.type, this.listener, this.useCapture);
  if (this.target === window || this.target === document) return;
  var domListener = this;
  this.destroyListener = function destroyDomListener() {
    domListener.remove();
  };
  elementAddDestroyListener(this.target, this.destroyListener);
};
DomListener.prototype.remove = function() {
  elementRemoveListener(this.target, this.type, this.listener, this.useCapture);
  elementRemoveDestroyListener(this.target, this.destroyListener);
};

function DestroyListener(target, listener) {
  this.type = 'destroy';
  this.target = target;
  this.listener = listener;
}
DestroyListener.prototype = Object.create(DomListener.prototype);
DestroyListener.prototype.constructor = DestroyListener;
DestroyListener.prototype.add = function() {
  elementAddDestroyListener(this.target, this.listener);
};
DestroyListener.prototype.remove = function() {
  elementRemoveDestroyListener(this.target, this.listener);
};
