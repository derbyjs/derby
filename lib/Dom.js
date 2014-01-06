module.exports = Dom;

function Dom(controller) {
  this.controller = controller;
}

Dom.prototype.addListener = function(target, type, listener, useCapture) {
  target.addEventListener(type, listener, !!useCapture);
  this.controller.on('destroy', removeEvent);
  function removeEvent() {
    target.removeEventListener(type, listener, !!useCapture);
  }
};
Dom.prototype.on = Dom.prototype.addListener;

Dom.prototype.once = function(target, type, listener, useCapture) {
  target.addEventListener(type, wrappedListener, !!useCapture);
  var controller = this.controller;
  controller.on('destroy', removeEvent);
  function removeEvent() {
    target.removeEventListener(type, wrappedListener, !!useCapture);
  }
  function wrappedListener() {
    controller.removeListener('destroy', removeEvent);
    removeEvent();
    return listener.apply(this, arguments);
  }
};

Dom.prototype.removeListener = function(target, type, listener, useCapture) {
  target.removeEventListener(type, listener, !!useCapture);
};
