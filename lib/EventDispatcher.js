function empty() {}
function EventDispatcherNames() {}
function EventDispatcherListeners() {}

module.exports = EventDispatcher;

function EventDispatcher(options) {
  this._onTrigger = options && options.onTrigger || empty;
  this._onBind = options && options.onBind || empty;
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
