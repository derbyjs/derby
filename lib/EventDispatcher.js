var _ = require('./utils');

var EventDispatcher = module.exports = function(triggerCallback, bindCallback) {
  this._triggerCallback = triggerCallback;
  if (bindCallback) {
    this.bind = function(name, listener) {
      if (bindCallback(name, listener)) {
        EventDispatcher.prototype.bind.call(this, name, listener);
      }
    };
  }
  this._names = {};
}
EventDispatcher.prototype = {
  bind: function(name, listener) {
    var names = this._names,
        key = JSON.stringify(listener),
        obj = names[name] || {};
    obj[key] = true;
    names[name] = obj;
  },
  unbind: function(name, listener) {
    var names = this._names,
        key = JSON.stringify(listener);
    delete names[name][key];
  },
  trigger: function(name, value, options) {
    var names = this._names,
        listeners = names[name],
        callback = this._triggerCallback;
    if (listeners && !_.onServer) {
      Object.keys(listeners).forEach(function(key) {
        var listener = JSON.parse(key);
        if (!callback(listener, value, options)) {
          delete listeners[key];
        }
      });
    }
  },
  get: function() {
    var names = this._names,
        out = {};
    Object.keys(names).forEach(function(name) {
      out[name] = Object.keys(names[name]).map(function(item) {
        return item.replace(/"/g, "'");
      });
    });
    return out;
  },
  set: function(n) {
    var names = this._names;
    Object.keys(n).forEach(function(name) {
      var obj = names[name] = {},
          listeners = n[name];
      listeners.forEach(function(listener) {
        obj[listener.replace(/'/g, '"')] = true;
      });
    });
  }
}