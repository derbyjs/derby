module.exports = {
  traverseNode: traverseNode
, pathMerge: pathMerge
, treeMerge: treeMerge
};

function traverseNode(node, segments) {
  var i, len, segment
  for (i = 0, len = segments.length; i < len; i++) {
    segment = segments[i];
    node = node[segment] || (node[segment] = {});
  }
  return node;
}

// Recursively set nested objects based on a path
function pathMerge(node, path, value, nodeFn) {
  var segments = path.split('.')
    , last, i, len, segment
  if (typeof value === 'object') {
    node = traverseNode(node, segments);
    treeMerge(node, value, nodeFn);
    return;
  }
  last = segments.pop();
  node = traverseNode(node, segments);
  node[last] = (nodeFn) ? nodeFn(value) : value;
}

// Recursively set objects such that the non-objects are
// merged with the corresponding structure of the base node
function treeMerge(node, tree, nodeFn) {
  var key, child, value
  for (key in tree) {
    value = tree[key];
    if (typeof value === 'object') {
      child = node[key] || (node[key] = {});
      treeMerge(child, value, nodeFn);
      continue;
    }
    node[key] = (nodeFn) ? nodeFn(value) : value;
  }
}
