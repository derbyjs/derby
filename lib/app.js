var EventEmitter = require('events').EventEmitter
  , racer = require('racer')
  , View = require('./View')
  , isBrowser = !racer.util.isServer

exports.create = createApp;
exports.treeMerge = treeMerge;

function createApp(derby, appModule) {
  var app = racer.util.merge(appModule.exports, EventEmitter.prototype)

  app.view = new View(derby._libraries, app, appModule.filename);
  app.fn = appFn;

  function appFn(value, fn) {
    if (typeof value === 'string') {
      pathMerge(app, value, fn, app);
    } else {
      treeMerge(app, value, app);
    }
    return app;
  }

  return app;
}

function traverseNode(node, segments) {
  var i, len, segment
  for (i = 0, len = segments.length; i < len; i++) {
    segment = segments[i];
    node = node[segment] || (node[segment] = {});
  }
  return node;
}

// Recursively set nested objects based on a path
function pathMerge(node, path, value, app) {
  var segments = path.split('.')
    , last, i, len, segment
  if (typeof value === 'object') {
    node = traverseNode(node, segments);
    treeMerge(node, value, app);
    return;
  // Don't bind the function on the server, since each
  // render gets passed a new model as part of the app
  } else if (isBrowser && typeof value === 'function') {
    value = value.bind(app);
  }
  last = segments.pop();
  node = traverseNode(node, segments);
  node[last] = value;
}

// Recursively set objects such that the non-objects are
// merged with the corresponding structure of the base node
function treeMerge(node, tree, app) {
  var key, child, value
  for (key in tree) {
    value = tree[key];
    if (typeof value === 'object') {
      child = node[key] || (node[key] = {});
      treeMerge(child, value, app);
      continue;
    // Don't bind the function on the server, since each
    // render gets passed a new model as part of the app
    } else if (isBrowser && typeof value === 'function') {
      value = value.bind(app);
    }
    node[key] = value;
  }
}
