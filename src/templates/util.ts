const objectProtoPropNames = Object.create(null);
Object.getOwnPropertyNames(Object.prototype).forEach(function(prop) {
  if (prop !== '__proto__') {
    objectProtoPropNames[prop] = true;
  }
});

export function checkKeyIsSafe(key) {
  if (key === '__proto__' || objectProtoPropNames[key]) {
    throw new Error(`Unsafe key "${key}"`);
  }
}

export function concat(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.concat(b);
}

export function hasKeys(value) {
  if (!value) return false;
  for (const key in value) {
    return true;
  }
  return false;
}

export function traverseAndCreate(node, segments) {
  const len = segments.length;
  if (!len) return node;
  for (let i = 0; i < len; i++) {
    const segment = segments[i];
    checkKeyIsSafe(segment);
    node = node[segment] || (node[segment] = {});
  }
  return node;
}
