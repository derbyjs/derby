function empty() {}

module.exports = EventDispatcher;

function EventDispatcher(options) {
  if (options == null) options = {};
  this._onTrigger = options.onTrigger || empty;
  this._onBind = options.onBind || empty;
  this.clear();
}

EventDispatcher.prototype = {
  clear: function() {
    this.names = {};
  }

, bind: function(name, listener, arg0) {
    this._onBind(name, listener, arg0);
    var names = this.names
      , obj = names[name] || {};
    obj[JSON.stringify(listener)] = listener;
    return names[name] = obj;
  }

, trigger: function(name, value, arg0, arg1, arg2, arg3, arg4, arg5) {
    var names = this.names
      , listeners = names[name]
      , onTrigger = this._onTrigger
      , count = 0
      , key, listener;
    for (key in listeners) {
      listener = listeners[key];
      count++;
      if (false !== onTrigger(name, listener, value, arg0, arg1, arg2, arg3, arg4, arg5)) {
        continue;
      }
      delete listeners[key];
      count--;
    }
    if (!count) delete names[name];
    return count;
  }
}
