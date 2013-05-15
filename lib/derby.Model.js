var EventDispatcher = require('./EventDispatcher')
var PathMap = require('./PathMap')
var Model = require('racer').Model
var valueBinding = require('./View').valueBinding
var arraySlice = [].slice;

exports.init = init;

// Add support for creating a model alias from a DOM node or jQuery object
Model.prototype.__at = Model.prototype.at;
Model.prototype.at = function(node) {
  var isNode = node && (node.parentNode || node.jquery && (node = node[0]));
  if (!isNode) return this.__at(node);

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
        return this.scope(path);
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
      return this.scope(path);
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

function init(derby, app) {
  var model = app.model
    , dom = app.dom
    , pathMap = model.__pathMap = new PathMap
    , events = model.__events = new EventDispatcher({onTrigger: derbyModelTrigger})

  function derbyModelTrigger(pathId, listener, type, isLocal, options, value, index, arg) {
    var id = listener[0]
      , el = dom.item(id);

    // Fail and remove the listener if the element can't be found
    if (!el) return false;

    var method = listener[1]
      , property = listener[2]
      , partial = listener.partial
      , path = pathMap.paths[pathId]
      , triggerId;
    if (method === 'propPolite' && isLocal) method = 'prop';
    if (partial) {
      triggerId = id;
      if (method === 'html' && type) {
        if (partial.type === 'each') {
          // Handle array updates
          method = type;
          if (type === 'insert') {
            path += '.' + index;
            triggerId = null;
          } else if (type === 'remove') {
            partial = null;
          } else if (type === 'move') {
            partial = null;
            property = arg;
          }
        } else {
          value = model.get(path);
        }
      }
    }
    if (listener.getValue) {
      value = listener.getValue(model, path);
    }
    if (partial) {
      // TODO Get rid of model.__fnCtx cache
      // Was causing issues with not emitting "init:child" or "create:child"
      // when dynamically rendering a component inside a parent component
      // within an each block.
      delete model.__fnCtx;

      if (method === 'insert' && value === void 0) {
        value = '<!--empty-->';
      } else {
        value = partial(listener.ctx, model, path, triggerId, value, index, listener);
      }
    }
    value = valueBinding(value);
    dom.update(el, method, options && options.ignore, value, property, index);
  }

  model.on('change', '**', function derbyOnChange(path, value, previous, isLocal, pass) {
    // For set operations on array items, also emit a remove and insert in case the
    // array is bound
    if (/\.\d+$/.test(path)) {
      var i = path.lastIndexOf('.');
      var arrayPath = path.slice(0, i);
      var index = path.slice(i + 1);
      triggerEach(arrayPath, 'remove', isLocal, pass, index);
      triggerEach(arrayPath, 'insert', isLocal, pass, value, index);
    }
    triggerEach(path, 'html', isLocal, pass, value);
  });

  model.on('load', '**', function derbyOnLoad(path, value, isLocal, pass) {
    triggerEach(path, 'html', isLocal, pass, value);
  });

  model.on('unload', '**', function derbyOnLoad(path, previous, isLocal, pass) {
    triggerEach(path, 'html', isLocal, pass, void 0);
  });

  model.on('insert', '**', function derbyOnInsert(path, index, values, isLocal, pass) {
    pathMap.onInsert(path, index, values.length);
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      triggerEach(path, 'insert', isLocal, pass, value, index + i);
    }
  });

  model.on('remove', '**', function derbyOnRemove(path, index, removed, isLocal, pass) {
    var howMany = removed.length;
    var end = index + howMany;
    pathMap.onRemove(path, index, howMany);
    for (var i = index; i < end; i++) {
      triggerEach(path, 'remove', isLocal, pass, index);
    }
  });

  model.on('move', '**', function derbyOnMove(path, from, to, howMany, isLocal, pass) {
    pathMap.onMove(path, from, to, howMany);
    triggerEach(path, 'move', isLocal, pass, from, howMany, to);
  });

  model.on('stringInsert', '**', function derbyOnStringInsert(path, index, value, isLocal, pass) {
    // TODO
  });

  model.on('stringRemove', '**', function derbyOnStringRemove(path, index, howMany, isLocal, pass) {
    // TODO
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

  return model;
}
