function empty() {}
function EventDispatcherNames() {}
function EventDispatcherListeners() {}
function CleanupPendingMap() {}

module.exports = EventDispatcher;

function EventDispatcher(options) {
  this._onTrigger = options && options.onTrigger || empty;
  this._onBind = options && options.onBind || empty;
  this._onCleanup = options && options.onCleanup;
  this._cleanupPending = new CleanupPendingMap();
  this.clear();
}

EventDispatcher.prototype.clear = function() {
  this.names = new EventDispatcherNames();
};

EventDispatcher.prototype.bind = function(name, listener, arg0) {
  this._onBind(name, listener, arg0);
  var obj = this.names[name] || (this.names[name] = new EventDispatcherListeners());
  obj[JSON.stringify(listener)] = listener;
  return obj;
};

EventDispatcher.prototype.trigger = function(name, value, arg0, arg1, arg2, arg3, arg4, arg5) {
  if (!name) return;
  var listeners = this.names[name];
  var onTrigger = this._onTrigger;
  var count = 0;
  var key, listener;
  for (key in listeners) {
    listener = listeners[key];
    count++;
    if (false !== onTrigger(name, listener, value, arg0, arg1, arg2, arg3, arg4, arg5)) {
      continue;
    }
    delete listeners[key];
    count--;
  }
  if (!count) delete this.names[name];
  return count;
};

EventDispatcher.prototype.delayedCleanup = function(name) {
  if (this._cleanupPending[name]) return;
  this._cleanupPending[name] = true;
  var eventDispatcher = this;
  setTimeout(function() {
    delete eventDispatcher._cleanupPending[name];
    eventDispatcher.cleanup(name);
  }, 0);
};

EventDispatcher.prototype.cleanup = function(name) {
  var listeners = this.names[name];
  var hasKeys = false;
  var key, remove;
  for (key in listeners) {
    remove = this._onCleanup(name, listeners[key]);
    if (remove) {
      delete listeners[key];
    } else {
      hasKeys = true;
    }
  }
  if (!hasKeys) delete this.names[name];
};
