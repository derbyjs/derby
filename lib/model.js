var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher'),
    world = {},
    funcs = {},
    funcInputs = {},
    dom, db, socket, client;

exports._link = function(d) {
  dom = d;
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
            path = args[0],
            value = args[1];
        if (_.publicModel(path)) {
          // Use the internal setter method, which won't generate any events
          // or broadcast to clients. All this does is update the server's model
          setters[method](path, value);
          send(method, args, client);
        }
      });
    });
  } else {
    socket.connect();
    socket.on('message', function(message) {
      var data = JSON.parse(message),
          method = data[0],
          args = data[1],
          path = args[0],
          value = args[1];
      // Use the external setter method to trigger events, but don't send this
      // update to the other clients. Since this message originated from
      // somewhere else, sending it again would echo the message forever.
      exports[method](path, value, true);
    });
  }
}

var events = exports.events = new EventDispatcher(
  function(listener, value, options) {
    var id, method, property, viewFunc,
        oldPathName, pathName, listenerObj, modelFunc;
    if (_.isArray(listener)) {
      id = listener[0];
      method = options && options.method || listener[1];
      property = listener[2];
      viewFunc = listener[3];
      // Remove this listener if the DOM update fails. This usually happens
      // when an id cannot be found
      return dom.update(id, method, property, viewFunc, value);
    } else if ((oldPathName = listener.$o) && (pathName = listener.$p) && (listenerObj = listener.$l)) {
      events.unbind(oldPathName, listenerObj);
      events.bind(pathName, listenerObj);
      events.trigger(pathName, get(pathName));
      // Remove this listener, since it will be replaced with a new one
      // in the bind action above
      return false;
    } else if ((modelFunc = listener.$f) && (pathName = listener.$p)) {
      events.trigger(pathName, get(pathName));
      return true;
    }
    // Remove this event if it wasn't handled
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
  }
);

var get = exports.get = function(path) {
  var obj = world,
      i, prop, ref, key, func, inputs;
  if (path) {
    path = path.split('.');
    for (i = 0; prop = path[i++];) {
      obj = obj[prop];
      // Return null if not found
      if (_.isUndefined(obj)) return null;
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

function lookup(path) {
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
          return { obj: ref, prop: key, path: eventPath.join('.') };
        } else {
          obj = ref[key];
        }
      } else {
        eventPath.push(prop);
        if (i === len) {
          return { obj: obj, prop: prop, path: eventPath.join('.') };
        } else {
          obj = child;
        }
      }
    }
  }
}
var setters = {
  set: function(path, value) {
    var out = lookup(path);
    out.obj[out.prop] = value;
    return out;
  },
  push: function(path, value) {
    var out = lookup(path);
    out.obj[out.prop].push(value);
    out.options = { method: 'appendHtml' };
    return out;
  }
};
_.forEach(setters, function(name, func) {
  exports[name] = function(path, value, noSend) {
    var out = func(path, value),
        path = out.path;
    events.trigger(path, value, out.options);
    if (_.publicModel(path) && !noSend) send(name, [path, value]);
  };
  exports[name + 'Silent'] = func;
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
exports.init = function(w, modelEvents) {
  world = w;
  if (modelEvents) events.set(modelEvents);
};