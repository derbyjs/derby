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
    view, db, socket, client;

exports._link = function(v) {
  view = v;
}
exports._setDb = function(d) {
  db = d;
}
exports._setSocket = function(s) {
  socket = s;
  
  if (_.onServer) {
    socket.on('connection', function(client) {
      client.on('message', function(message) {
        var data = JSON.parse(message),
            method = data[0],
            args = data[1],
            path = args[0];
        if (_.publicModel(path)) {
          setters[method].apply(null, args);
          send(method, args, client);
        }
      });
    });
  } else {
    socket.connect();
    socket.on('message', function(message) {
      var data = JSON.parse(message),
          method = data[0],
          args = data[1];
      setters[method].apply(null, args);
    });
  }
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
      exports.set(pathName, get(pathName));
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


function message(method, args) {
  return JSON.stringify(
    [method, _.toArray(args)]
  );
}
var send = _.onServer ?
  function (method, args, client) {
    client = client || socket;
    if (client) client.broadcast(message(method, args));
    if (db) db.message(method, args);
  } :
  function (method, args) {
    if (socket) socket.send(message(method, args));
  };

var setters = {
  set: function(path, value, silent, sendUpdate) {
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
    if (sendUpdate && _.publicModel(eventPath)) send('set', [eventPath, value]);
  },
  push: function(path, value, silent, sendUpdate) {
    var arr = world[path];
    arr.push(value);
    if (silent) return;
    events.trigger(path, arr, 'push');
    if (sendUpdate && _.publicModel(path)) send('push', [path, value]);
  }
};
_.forEach(setters, function(name, func) {
  exports[name] = function(path, value) {
    func(path, value, false, true);
  };
  exports[name + 'Silent'] = function(path, value) {
    func(path, value, true, true);
  };
});

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