var objectProtoPropNames = Object.create(null);
Object.getOwnPropertyNames(Object.prototype).forEach(function(prop) {
  if (prop !== '__proto__') {
    objectProtoPropNames[prop] = true;
  }
});
function checkKeyIsSafe(key) {
  if (key === '__proto__' || objectProtoPropNames[key]) {
    throw new Error('Unsafe key "' + key + '"');
  }
}
exports.checkKeyIsSafe = checkKeyIsSafe;

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
    checkKeyIsSafe(segment);
    node = node[segment] || (node[segment] = {});
  }
  return node;
};
