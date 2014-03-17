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
    for (var i = listeners.length; i--;) {
      listeners[i].remove();
    }
    dom._listeners = null;
  });
  return this._listeners = [];
};

Dom.prototype._listenerIndex = function(domListener) {
  var listeners = this._listeners;
  if (!listeners) return -1;
  for (var i = listeners.length; i--;) {
    if (listeners[i].equals(domListener)) return i;
  }
  return -1;
};

Dom.prototype.addListener = function() {
  var args = Array.prototype.slice.call(arguments);
  var type, target, listener, useCapture;
  if (typeof args[1] === 'function') {
    target     = document;
    type       = args[0];
    listener   = args[1];
    useCapture = args[2];
  } else {
    type       = args[0];
    target     = args[1];
    listener   = args[2];
    useCapture = args[3];
  }
  var domListener = new DomListener(type, target, listener, useCapture);
  if (-1 === this._listenerIndex(domListener)) {
    var listeners = this._listeners || this._initListeners();
    listeners.push(domListener);
  }
  domListener.add();
};
Dom.prototype.on = Dom.prototype.addListener;

Dom.prototype.once = function() {
  var args = Array.prototype.slice.call(arguments);
  var type, target, listener, useCapture;
  if (typeof args[1] === 'function') {
    target     = document;
    type       = args[0];
    listener   = args[1];
    useCapture = args[2];
  } else {
    type       = args[0];
    target     = args[1];
    listener   = args[2];
    useCapture = args[3];
  }
  this.addListener(type, target, wrappedListener, useCapture);
  var dom = this;
  function wrappedListener() {
    dom.removeListener(type, target, wrappedListener, useCapture);
    return listener.apply(this, arguments);
  }
};

Dom.prototype.removeListener = function() {
  var args = Array.prototype.slice.call(arguments);
  var type, target, listener, useCapture;
  if (typeof args[1] === 'function') {
    target     = document;
    type       = args[0];
    listener   = args[1];
    useCapture = args[2];
  } else {
    type       = args[0];
    target     = args[1];
    listener   = args[2];
    useCapture = args[3];
  }
  var domListener = new DomListener(type, target, listener, useCapture);
  domListener.remove();
  var i = this._listenerIndex(domListener);
  if (i > -1) this._listeners.splice(i, 1);
};

function DomListener(type, target, listener, useCapture) {
  this.type = type;
  this.target = target;
  this.listener = listener;
  this.useCapture = !!useCapture;
}
DomListener.prototype.equals = function(domListener) {
  return this.listener === domListener.listener &&
    this.target === domListener.target &&
    this.type === domListener.type &&
    this.useCapture === domListener.useCapture;
};
DomListener.prototype.add = function() {
  this.target.addEventListener(this.type, this.listener, this.useCapture);
};
DomListener.prototype.remove = function() {
  this.target.removeEventListener(this.type, this.listener, this.useCapture);
};
