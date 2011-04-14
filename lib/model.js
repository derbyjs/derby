var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher'),
    world = {},
    funcs = {},
    funcInputs = {},
    emptyEl = (_.onServer) ? null : document.createElement('div'),
    setMethods = {
      attr: function(value, el, attr) {
        el.setAttribute(attr, value);
      },
      prop: function(value, el, prop) {
        el[prop] = value;
      },
      propLazy: function(value, el, prop) {
        if (el !== document.activeElement) el[prop] = value;
      },
      html: function(value, el, escape) {
        if (escape) el.innerHTML = view.htmlEscape(value);
      },
      appendHtml: function(value, el) {
        var child;
        emptyEl.innerHTML = value;
        while (child = emptyEl.firstChild) {
          el.appendChild(child);
        }
      }
    },
    socket, view, db;

exports._link = function(v) {
  view = v;
}

exports._setSocket = function(o) {
  socket = o;
}

exports._setDb = function(o) {
  db = o;
}

var events = exports.events = new EventDispatcher(
  function(listener, value, options) {
    var id, method, property, viewFunc, el, s,
        oldPathName, pathName, listenerObj, modelFunc;
    if (_.isArray(listener)) {
      id = listener[0];
      method = listener[1];
      property = listener[2];
      viewFunc = listener[3];
      if (id === '__document') {
        el = document;
      } else if (id === '__window') {
        el = window;
      } else {
        el = document.getElementById(id);
      }
      // The element can't be found, so remove this handler
      if (!el) return false;
      // If this is the result of a model function assignment, keep the handler
      // but don't perform any updates
      if (value.$f) return true;
      if (options) {
        switch (options) {
          case 'push':
            s = view._get(viewFunc, value[value.length - 1]);
            setMethods.appendHtml(s, el);
            break;
        }
      } else {
        s = (viewFunc) ? view._get(viewFunc, value) : value;
        setMethods[method](s, el, property);
      }
      return true;
    } else if ((oldPathName = listener.$o) && (pathName = listener.$p) && (listenerObj = listener.$l)) {
      events.unbind(oldPathName, listenerObj);
      events.bind(pathName, listenerObj);
      // Set the object to itself to trigger change event
      set(pathName, get(pathName));
      // Remove this handler, since it will be replaced with a new handler
      // in the bind action above
      return false;
    } else if ((modelFunc = listener.$f) && (pathName = listener.$p)) {
      events.trigger(pathName, get(pathName));
      return true;
    }
    // Remove this event if it can't be handled
    return false;
  }, function(pathName, listener) {
    var obj = world,
        path, i, prop, refName, keyName, ref, key, eventPath, modelFunc, inputs;
    path = pathName.split('.');
    for (i = 0; prop = path[i++];) {
      obj = obj[prop];
      if (_.isUndefined(obj)) return false; // Remove bad event handler
      if ((refName = obj.$r) && (keyName = obj.$k)) {
        key = get(keyName);
        ref = get(refName);
        eventPath = [refName, key].concat(path.slice(i)).join('.');
        // Register an event to update the other event handler when the
        // reference key changes
        events.bind(keyName, {$o: eventPath, $p: pathName, $l: listener});
        // Bind the event to the dereferenced path
        events.bind(eventPath, listener);
        // Cancel the creation of the event to the reference itself
        return false;
      } else if ((modelFunc = obj.$f)) {
        // Bind a listener to each of the inputs to the function
        funcInputs[modelFunc].forEach(function(item) {
          events.bind(item, {$f: modelFunc, $p: pathName});
        });
      }
    }
    return true;
  }
);

var get = exports.get = function(path) {
  var obj = world,
      i, prop, ref, key, func, inputs;
  if (path) {
    path = path.split('.');
    for (i = 0; prop = path[i++];) {
      obj = obj[prop];
      if (_.isUndefined(obj)) return null; // Return null if not found
      if ((ref = obj.$r) && (key = obj.$k)) {
        ref = get(ref);
        key = get(key);
        obj = ref[key];
      } else if (func = obj.$f) {
        inputs = funcInputs[func];
        inputs = (inputs.map) ? inputs.map(get) : [];
        func = funcs[func];
        if (func) obj = func.apply(null, inputs);
      }
    }
  }
  return obj;
};

var send = function(method, args, broadcast){
  var message = JSON.stringify(
    [method, _.toArray(args)]
  );
  if (_.onServer) {
    if (broadcast && socket) {
      socket.broadcast(message);
    }
    if (db && _.publicModel(args[0])) {
      db.message(method, args);
    }
  } else {
    socket.send(message);
  }
};

var _set = exports._set = function(path, value, silent, sendUpdate, broadcast) {
  var obj = world,
      eventPath = [],
      i, prop, len, child, ref, key;
  if (path) {
    path = path.split('.');
    len = path.length;
    for (i = 0; prop = path[i++];) {
      child = obj[prop];
      if (child && (ref = child.$r) && (key = child.$k)) {
        key = get(key);
        eventPath = [ref, key];
        ref = get(ref);
        if (i === len) {
          ref[key] = value;
        } else {
          obj = ref[key];
        }
      } else {
        if (i === len) {
          obj[prop] = value;
        } else {
          obj = child;
        }
        eventPath.push(prop);
      }
    }
  }
  if (silent) return;
  eventPath = eventPath.join('.');
  events.trigger(eventPath, value);
  if (sendUpdate) send('set', [eventPath, value], broadcast);
};
var set = exports.set = function(path, value, broadcast) {
  _set(path, value, false, true, broadcast);
};
var setSilent = exports.setSilent = function(path, value) {
  _set(path, value, true);
};

var _push = exports._push = function(name, value, sendUpdate, broadcast) {
  var arr = world[name];
  arr.push(value);
  events.trigger(name, arr, 'push');
  if (sendUpdate) send('push', [name, value], broadcast);
};
var push = exports.push = function(name, value, broadcast) {
  _push(name, value, true, broadcast);
};

exports.func = function(name) {
  return {$f: name};
};
exports.makeFunc = function(name, inputs, func) {
  funcs[name] = func;
  funcInputs[name] = inputs;
}
exports.ref = function(ref, key) {
  return {$r: ref, $k: key};
};
exports.init = function(w) {
  world = w;
};