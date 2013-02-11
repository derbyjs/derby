var EventEmitter = require('events').EventEmitter
  , racer = require('racer')
  , View = require('./View')
  , collection = require('./collection')
  , isServer = racer.util.isServer

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

  app._Collections = {};
  app.Collection = collection.construct.bind(app);

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
  }
  last = segments.pop();
  node = traverseNode(node, segments);
  node[last] = bindPage(value, app);
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
    }
    node[key] = bindPage(value, app);
  }
}

function bindPage(fn, app) {
  // Don't bind the function on the server, since each
  // render gets passed a new model as part of the app
  if (isServer) return fn;
  return function() {
    return fn.apply(app.page, arguments);
  };
}
