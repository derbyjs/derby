var _ = require('./utils');

var EventDispatcher = module.exports = function(onTrigger, onBind, onUnbind) {
  var empty = function() {};
  this._onTrigger = onTrigger || empty;
  this._onBind = onBind || empty;
  this._onUnbind = onUnbind || empty;
  this.trigger = _.onServer ? empty : this._trigger;
  this._names = {};
}
EventDispatcher.prototype = {
  bind: function(name, listener) {
    if (this._onBind(name, listener) === false) return;
    var names = this._names,
        key = _.isDefined(listener) ? JSON.stringify(listener) : 'null',
        obj = names[name] || {};
    obj[key] = true;
    names[name] = obj;
  },
  unbind: function(name, listener) {
    if (this._onUnbind(name, listener) === false) return;
    var names = this._names,
        obj = names[name],
        key = JSON.stringify(listener);
    if (obj) {
      if (obj[key]) delete obj[key];
      if (!Object.keys(obj).length) delete names[name];
    }
  },
  _trigger: function(name, value, options) {
    var names = this._names,
        listeners = names[name],
        onTrigger = this._onTrigger,
        i = 0,
        deleted = 0,
        key;
    for (key in listeners) {
      i++;
      listener = JSON.parse(key);
      if (onTrigger(name, listener, value, options) === false) {
        delete listeners[key];
        deleted++;
      }
    }
    if (i - deleted === 0) delete names[name];
  },
  get: function() {
    // The output of this function will be encoded in JSON and sent to the
    // browser. Therefore, this function transforms the event data from a key
    // value lookup into an array, which is a much more compact respresentation.
    // In addition, it swaps quote types to reduce the need for escaping
    var names = this._names,
        out = {};
    Object.keys(names).forEach(function(name) {
      out[name] = Object.keys(names[name]).map(swapQuotes);
    });
    return out;
  },
  set: function(n) {
    // Undo the transforms done in the get function and add the new events
    var names = this._names;
    Object.keys(n).forEach(function(name) {
      var obj = names[name] = {},
          listeners = n[name];
      listeners.forEach(function(listener) {
        obj[swapQuotes(listener)] = true;
      });
    });
  }
}

function swapQuotes(s) {
  return s.replace(/['"]/g, function(match) {
    return match === '"' ? "'" : '"';
  });
}

