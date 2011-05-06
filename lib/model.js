// This module is wrapped in a function so that multiple instances can be
// created for testing. Typically, only one instance is created.
module.exports = function() {

var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher'),
    onServer = _.onServer,
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
  
  if (onServer) {
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
function message(method, args) {
  return JSON.stringify(
    [method, _.toArray(args)]
  );
}
var send = onServer ?
  function (method, args, client) {
    client = client || socket;
    if (client) client.broadcast(message(method, args));
    if (db) db.message(method, args);
  } :
  function (method, args) {
    if (socket) socket.send(message(method, args));
  };

function lookup(path, options) {
  var options = options || {},
      set = options.set,
      onRef = options.onRef,
      onFunc = options.onFunc,
      obj = world,
      props, i, prop, len, next,
      ref, refObj, key, keyObj, keys = [],
      funcName, func, inputNames, inputs;
  if (path) {
    try {
      props = path.split('.');
    } catch (e) {
      throw new Error('Invalid model path: ' + path);
    }
  
    path = '';
    len = props.length;
    for (i = 0; prop = props[i++];) {
    
      // Get the next object along the path
      next = obj[prop];
      if (_.isUndefined(next)) {
        if (set) {
          // In set, create empty parent objects implied by the path
          next = obj[prop] = {};
        } else {
          // If an object can't be found, return null
          return { obj: null };
        }
      }
    
      // Check for model references
      if (ref = next.$r) {
        refObj = get(ref);
        if (key = next.$k) {
          keyObj = get(key);
          path = ref + '.' + keyObj;
          next = refObj[keyObj];
        } else {
          path = ref;
          next = refObj;
        }
        if (onRef) keys.push(key);
    
      } else {
        // Check for model functions
        if (funcName = next.$f) {
          inputNames = funcInputs[funcName];
          inputs = (inputNames.map) ? inputNames.map(get) : [];
          func = funcs[funcName];
          if (func) next = func.apply(null, inputs);
          if (onFunc) onFunc(inputNames);
        }
      
        // Store the absolute path traversed so far
        path = path ? path + '.' + prop : prop;
      }
    
      if (set && i === len) {
        // Return one iteration early for set
        return { obj: obj, prop: prop, path: path };
      }
      obj = next;
    }
  }
  keys.forEach(function(item) { onRef(item, path) });
  return { obj: obj, path: path };
}

function onTrigger(listener, value, options) {
  var id, method, property, viewFunc, path, keep, refPath, obj;
  if (_.isArray(listener)) {
    id = listener[0];
    method = options && options.method || listener[1];
    property = listener[2];
    viewFunc = listener[3];
    // Remove this listener if the DOM update fails. This usually happens
    // when an id cannot be found
    return dom.update(id, method, property, viewFunc, value);
  } else if (listener && (path = listener.$p)) {
    keep = true;
    if ((refPath = listener.$r) && (obj = listener.$l)) {
      events.unbind(refPath, obj);
      events.bind(path, obj);
      // Remove this listener, since it will be replaced with a new one
      // in the bind action above
      keep = false;
    }
    events.trigger(path, get(path));
    return keep;
  }
  // Remove unhandled listener
  return false;
}
function onBind(path, listener) {
  var keep = true;
  function onRef(key, refPath) {
    // Register an event to update the other event handler when the
    // reference key changes
    if (key) events.bind(key, { $r: refPath, $p: path, $l: listener });
    // Bind the event to the dereferenced path
    events.bind(refPath, listener);
    keep = false;
  }
  function onFunc(inputs) {
    // Bind a listener to each of the inputs to the function
    inputs.forEach(function(input) {
      events.bind(input, { $p: path });
    });
  }
  lookup(path, { onRef: onRef, onFunc: onFunc });
  return keep;
}
var events = exports.events = new EventDispatcher(onTrigger, onBind);

var get = exports.get = function(path) {
  return lookup(path).obj;
};

var setters = {
  set: function(path, value) {
    var out = lookup(path, { set: true });
    try {
      out.obj[out.prop] = value;
    } catch (e) {
      throw new Error('Model set failed on: ' + path);
    }
    return out;
  },
  push: function(path, value) {
    var out = lookup(path),
        obj = out.obj;
    try {
      obj.push(value);
    } catch (e) {
      throw new Error('Model push failed on: ' + path);
    }
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
  return { $f: name };
};
exports.makeFunc = function(name, inputs, func) {
  funcs[name] = func;
  funcInputs[name] = inputs;
}
exports.ref = function(ref, key) {
  return _.isDefined(key) ? { $r: ref, $k: key } : { $r: ref };
};
exports.init = function(w, modelEvents) {
  world = w;
  if (modelEvents) events.set(modelEvents);
};

return exports;
}