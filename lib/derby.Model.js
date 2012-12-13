var EventDispatcher = require('./EventDispatcher')
  , PathMap = require('./PathMap')
  , Model = require('racer')["protected"].Model
  , valueBinding = require('./View').valueBinding
  , arraySlice = [].slice;

exports.init = init;

// Add support for creating a model alias from a DOM node or jQuery object
Model.prototype.__at = Model.prototype.at;
Model.prototype.at = function(node, absolute) {
  var isNode = node && (node.parentNode || node.jquery && (node = node[0]));
  if (!isNode) return this.__at(node, absolute);

  updateMarkers();

  var blockPaths = this.__blockPaths
    , pathMap = this.__pathMap
    , root = this._root
    , child, i, id, last, path, blockPath, children, len;
  while (node) {
    if (node.$derbyMarkerParent && last) {
      node = last;
      while (node = node.previousSibling) {
        if (!(id = node.$derbyMarkerId)) continue;
        blockPath = blockPaths[id];
        if (node.$derbyMarkerEnd || !blockPath) break;

        path = pathMap.paths[blockPath.id];
        if ((blockPath.type === 'each') && last) {
          i = 0;
          while (node = node.nextSibling) {
            if (node === last) {
              path = path + '.' + i;
              break;
            }
            i++;
          }
        }
        return this.__at(path, true);
      }
      last = last.parentNode;
      node = last.parentNode;
      continue;
    }
    if ((id = node.id) && (blockPath = blockPaths[id])) {
      path = pathMap.paths[blockPath.id];
      if ((blockPath.type === 'each') && last) {
        children = node.childNodes;
        for (i = 0, len = children.length; i < len; i++) {
          child = children[i];
          if (child === last) {
            path = path + '.' + i;
            break;
          }
        }
      }
      return this.__at(path, true);
    }
    last = node;
    node = node.parentNode;
  }

  // Just return the root scope if a path can't be found
  return root;
}

function updateMarkers() {
  // NodeFilter.SHOW_COMMENT == 128
  var commentIterator = document.createTreeWalker(document.body, 128, null, false)
    , comment, id;
  while (comment = commentIterator.nextNode()) {
    if (comment.$derbyChecked) continue;
    comment.$derbyChecked = true;
    id = comment.data;
    if (id.charAt(0) !== '$') continue;
    if (id.charAt(1) === '$') {
      comment.$derbyMarkerEnd = true;
      id = id.slice(1);
    }
    comment.$derbyMarkerId = id;
    comment.parentNode.$derbyMarkerParent = true;
  }
}

function init(model, dom, view) {
  var pathMap = model.__pathMap = new PathMap;
  var events = model.__events = new EventDispatcher({
    onTrigger: derbyModelTrigger
  });

  function derbyModelTrigger(pathId, listener, type, local, options, value, index, arg) {
    var id = listener[0]
      , el = dom.item(id);

    // Fail and remove the listener if the element can't be found
    if (!el) return false;

    var method = listener[1]
      , property = listener[2]
      , partial = listener.partial
      , path = pathMap.paths[pathId]
      , triggerId;
    if (method === 'propPolite' && local) method = 'prop';
    if (partial) {
      triggerId = id;
      if (method === 'html' && type) {
        if (partial.type === 'each') {
          // Handle array updates
          method = type;
          if (type === 'append') {
            path += '.' + (index = model.get(path).length - 1);
            triggerId = null;
          } else if (type === 'insert') {
            path += '.' + index;
            triggerId = null;
          } else if (type === 'remove') {
            partial = null;
          } else if (type === 'move') {
            partial = null;
            property = arg;
          }
        } else {
          value = model.get(path)
        }
      }
    }
    if (listener.getValue) {
      value = listener.getValue(model, path);
    }
    if (partial) {
      value = partial(listener.ctx, model, path, triggerId, value, index, listener);
    }
    value = valueBinding(value);
    dom.update(el, method, options && options.ignore, value, property, index);
  }

  // Derby's mutator listeners are added via unshift instead of model.on, because
  // it needs to handle events in the same order that racer applies mutations.
  // If there is a listener to an event that applies a mutation, event listeners
  // later in the listeners queues could receive events in a different order

  model.listeners('set').unshift(function listenerDerbySet(args, out, local, pass) {
    var arrayPath, i, index, path, value;
    model.emit('pre:set', args, out, local, pass);
    path = args[0], value = args[1];

    // For set operations on array items, also emit a remove and insert in case the
    // array is bound
    if (/\.\d+$/.test(path)) {
      i = path.lastIndexOf('.');
      arrayPath = path.slice(0, i);
      index = path.slice(i + 1);
      triggerEach(arrayPath, 'remove', local, pass, index);
      triggerEach(arrayPath, 'insert', local, pass, value, index);
    }
    return triggerEach(path, 'html', local, pass, value);
  });

  model.listeners('del').unshift(function listenerDerbyDel(args, out, local, pass) {
    model.emit('pre:del', args, out, local, pass);
    var path = args[0];
    return triggerEach(path, 'html', local, pass);
  });

  model.listeners('push').unshift(function listenerDerbyPush(args, out, local, pass) {
    model.emit('pre:push', args, out, local, pass);
    var path = args[0]
      , values = arraySlice.call(args, 1);
    for (var i = 0, len = values.length, value; i < len; i++) {
      value = values[i];
      triggerEach(path, 'append', local, pass, value);
    }
  });

  model.listeners('move').unshift(function listenerDerbyMove(args, out, local, pass) {
    model.emit('pre:move', args, out, local, pass);
    var path = args[0]
      , from = args[1]
      , to = args[2]
      , howMany = args[3]
      , len = model.get(path).length;
    from = refIndex(from);
    to = refIndex(to);
    if (from < 0) from += len;
    if (to < 0) to += len;
    if (from === to) return;
    // Update indicies in pathMap
    pathMap.onMove(path, from, to, howMany);
    triggerEach(path, 'move', local, pass, from, howMany, to);
  });

  model.listeners('unshift').unshift(function listenerDerbyUnshift(args, out, local, pass) {
    model.emit('pre:unshift', args, out, local, pass);
    var path = args[0]
      , values = arraySlice.call(args, 1);
    insert(path, 0, values, local, pass);
  });

  model.listeners('insert').unshift(function listenerDerbyInsert(args, out, local, pass) {
    model.emit('pre:insert', args, out, local, pass);
    var path = args[0]
      , index = args[1]
      , values = arraySlice.call(args, 2);
    insert(path, index, values, local, pass);
  });

  model.listeners('remove').unshift(function listenerDerbyRemove(args, out, local, pass) {
    model.emit('pre:remove', args, out, local, pass);
    var path = args[0]
      , start = args[1]
      , howMany = args[2];
    remove(path, start, howMany, local, pass);
  });

  model.listeners('pop').unshift(function listenerDerbyPop(args, out, local, pass) {
    model.emit('pre:pop', args, out, local, pass);
    var path = args[0];
    remove(path, model.get(path).length, 1, local, pass);
  });

  model.listeners('shift').unshift(function listenerDerbyShift(args, out, local, pass) {
    model.emit('pre:shift', args, out, local, pass);
    var path = args[0];
    remove(path, 0, 1, local, pass);
  });

  ['connected', 'canConnect'].forEach(function(event) {
    model.listeners(event).unshift(function(value) {
      triggerEach(event, null, true, null, value);
    });
  });

  model.on('reInit', function() {
    view.history.refresh();
  });

  function triggerEach(path, arg0, arg1, arg2, arg3, arg4, arg5) {
    // While rendering the entire page, don't update any bindings
    if (dom._preventUpdates) return;

    var id = pathMap.ids[path]
      , segments = path.split('.')
      , i, pattern;

    // Trigger an event on the path if it has a pathMap ID
    if (id) events.trigger(id, arg0, arg1, arg2, arg3, arg4, arg5);

    // Also trigger a pattern event for the path and each of its parent paths
    // This is used by view helper functions to match updates on a path
    // or any of its child segments
    i = segments.length + 1;
    while (--i) {
      pattern = segments.slice(0, i).join('.') + '*';
      if (id = pathMap.ids[pattern]) {
        events.trigger(id, arg0, arg1, arg2, arg3, arg4, arg5);
      }
    }
  }

  // Get index if event was from refList id object
  function refIndex(obj) {
    return typeof obj === 'object' ? obj.index : +obj;
  }

  function insert(path, start, values, local, pass) {
    start = refIndex(start);
    // Update indicies in pathMap
    pathMap.onInsert(path, start, values.length);
    for (var i = 0, len = values.length, value; i < len; i++) {
      value = values[i];
      triggerEach(path, 'insert', local, pass, value, start + i);
    }
  }

  function remove(path, start, howMany, local, pass) {
    start = refIndex(start);
    var end = start + howMany;
    // Update indicies in pathMap
    pathMap.onRemove(path, start, howMany);
    for (var i = start; i < end; i++) {
      triggerEach(path, 'remove', local, pass, start);
    }
  }

  return model;
}
