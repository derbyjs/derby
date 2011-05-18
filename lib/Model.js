var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher');

var Model = module.exports = function() {
  var self = this,
      _lookup;
  self._world = {};
  self._funcs = {};
  self._funcInputs = {};
  self.events = new EventDispatcher(onTrigger.bind(self), onBind.bind(self), onUnbind);

  _lookup = self._lookup = function(path, options) {
    var options = options || {},
        obj = self._world,
        props;
    if (path && path.split) {
      props = path.split('.');
      return lookup(
        obj, props, props.length, 0, '',
        self.get, self._funcs, self._funcInputs,
        options.isSet, options.onRef, options.onFunc
      );
    } else {
      return { obj: obj, path: '' };
    }
  };
  self.get = function(path) {
    return _lookup(path).obj;
  };
  _.forEach(setters, function(name, func) {
    var silentName = name + 'Silent';
    self[name] = function(path, value, noSend) {
      var out = self[silentName](path, value),
          path = out.path;
      self.events.trigger(path, value, out.options);
      if (_.publicModel(path) && !noSend) self._send(name, [path, value]);
    };
    self[silentName] = func.bind(self);
  });

  function message(method, args) {
    return JSON.stringify(
      [method, _.toArray(args)]
    );
  }
  if (_.onServer) {
    self._send = function(method, args, client) {
      client = client || self._socket;
      if (client) client.broadcast(message(method, args));
      if (self._db) self._db.message(method, args);
    };
    self._initSocket = function(socket) {
      socket.on('connection', function(client) {
        client.on('message', function(message) {
          var data = JSON.parse(message),
              method = data[0],
              args = data[1],
              path = args[0],
              value = args[1];
          if (_.publicModel(path)) {
            self[method](path, value, true);
            self._send(method, args, client);
          }
        });
      });
    }
  } else {
    self._send = function(method, args) {
      if (self._socket) self._socket.send(message(method, args));
    };
    self._initSocket = function(socket) {
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
        self[method](path, value, true);
      });
    };
  }
};
Model.prototype = {
  _link: function(dom) {
    this._dom = dom;
  },
  _setDb: function(db) {
    this._db = db;
  },
  _setSocket: function(socket) {
    this._socket = socket;
    this._initSocket(socket);
  },
  func: function(name) {
    return { $f: name };
  },
  makeFunc: function(name, inputs, func) {
    this._funcs[name] = func;
    this._funcInputs[name] = inputs;
  },
  ref: function(ref, key) {
    return _.isDefined(key) ? { $r: ref, $k: key } : { $r: ref };
  },
  init: function(world, modelEvents) {
    this._world = world;
    if (modelEvents) this.events.set(modelEvents);
  }
}

function onTrigger(path, listener, value, options) {
  var events = this.events,
      get = this.get,
      id, method, property, viewFunc, path, oldPath, obj, out;
  if (_.isArray(listener)) {
    // Check to see if this event is triggering for the right object. Remove
    // this listener if it is now stale
    oldPath = listener[4];
    if (!((oldPath === path) || (get(oldPath) === get(path)))) return false;

    id = listener[0];
    method = options && options.method || listener[1];
    property = listener[2];
    viewFunc = listener[3];
    // Remove this listener if the DOM update fails. This usually happens
    // when an id cannot be found
    return this._dom.update(id, method, property, viewFunc, value);
  } else if (listener && (path = listener.$p)) {
    if (obj = listener.$l) {
      events.bind(path, obj);
    }
    out = this._lookup(path);
    events.trigger(out.path, out.obj);
    return true;
  }
  // Remove unhandled listener
  return false;
};
function onUnbind(path, listener) {
  // Save the original path in the listener to be checked at trigger time
  if (_.isArray(listener) && !listener[4]) listener[4] = path;
};
function onBind(path, listener) {
  var keep = true,
      events = this.events;
  onUnbind(path, listener)

  function onRef(key, refPath) {
    // Bind an event to create a new listener when the reference key changes
    if (key) events.bind(key, { $p: path, $l: listener });
    // Bind an event to the dereferenced path
    events.bind(refPath, listener);
    keep = false;
  }
  function onFunc(inputs) {
    // Bind an event to each of the inputs to the function
    inputs.forEach(function(input) {
      events.bind(input, { $p: path });
    });
  }
  this._lookup(path, { onRef: onRef, onFunc: onFunc });
  return keep;
};

function lookup(obj, props, len, i, path, get, funcs, funcInputs, isSet, onRef, onFunc) {
  var prop = props[i++],
      next, ref, refObj, key, keyObj, remainder,
      funcName, func, inputNames, inputs;
  
  // Get the next object along the path
  next = obj[prop];
  if (_.isUndefined(next)) {
    if (isSet) {
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
    if (onRef) {
      remainder = [path].concat(props.slice(i));
      onRef(key, remainder.join('.'));
    }
  } else {
    // Store the absolute path traversed so far
    path = path ? path + '.' + prop : prop;
  }

  // Check for model functions
  if (funcName = next.$f) {
    inputNames = funcInputs[funcName];
    inputs = (inputNames && inputNames.map) ? inputNames.map(get) : [];
    func = funcs[funcName];
    if (func) next = func.apply(null, inputs);
    if (onFunc && inputNames && !ref) onFunc(inputNames);
  }
  
  return (i < len) ?
    lookup(next, props, len, i, path, get, funcs, funcInputs, isSet, onRef, onFunc) :
    (isSet) ? { obj: obj, prop: prop, path: path } : { obj: next, path: path };
};

var setters = {
  set: function(path, value) {
    var out = this._lookup(path, { isSet: true });
    try {
      out.obj[out.prop] = value;
    } catch (e) {
      throw new Error('Model set failed on: ' + path);
    }
    return out;
  },
  push: function(path, value) {
    var out = this._lookup(path),
        obj = out.obj;
    try {
      obj.push(value);
    } catch (e) {
      throw new Error('Model push failed on: ' + path);
    }
    out.options = { method: 'appendHtml' };
    return out;
  }
}