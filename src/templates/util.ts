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
    node = node[segment] || (node[segment] = {});
  }
  return node;
}
