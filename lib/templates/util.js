
exports.concat = function(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.concat(b);
};

exports.hasKeys = function(value) {
  if (!value) return false;
  for (var key in value) {
    return true;
  }
  return false;
};

exports.traverseAndCreate = function(node, segments) {
  var len = segments.length;
  if (!len) return node;
  for (var i = 0; i < len; i++) {
    var segment = segments[i];
    node = node[segment] || (node[segment] = {});
  }
  return node;
};
