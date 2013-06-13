var trimLeading = require('html-util').trimLeading;

exports.wrapRemainder = wrapRemainder;
exports.extractPlaceholder = extractPlaceholder;
exports.pathFnArgs = pathFnArgs;
exports.squareBracketsArgs = squareBracketsArgs;
exports.ctxPath = ctxPath;
exports.getValue = getValue;
exports.dataValue = dataValue;
exports.setBoundFn = setBoundFn;
exports.patchCtx = patchCtx;
exports.lookup = lookup;
exports.replaceSquareBrackets = replaceSquareBrackets;

function wrapRemainder(tagName, remainder) {
  if (!remainder) return false;
  return !(new RegExp('^<\/' + tagName, 'i')).test(remainder);
}

var openPlaceholder = /^([\s\S]*?)(\{{1,3})\s*([\s\S]*)/
  , aliasContent = /^([\s\S]*)\s+as\s+:(\S+)\s*$/
  , blockContent = /^([\#\/]?)(else\sif|if|else|unless|each|with|unescaped)?\s*([\s\S]*?)\s*$/
  , closeMap = { 1: '}', 2: '}}' }
function extractPlaceholder(text) {
  var match = openPlaceholder.exec(text);
  if (!match) return;
  var pre = match[1]
    , open = match[2]
    , remainder = match[3]
    , openLen = open.length
    , bound = openLen === 1
    , end = matchBraces(remainder, openLen, 0, '{', '}')
    , endInner = end - openLen
    , inner = remainder.slice(0, endInner)
    , post = remainder.slice(end)
    , alias, hash, type, name, escaped;

  if (/["{[]/.test(inner)) {
    // Make sure that we didn't accidentally match a JSON literal
    try {
      JSON.parse(open + inner + closeMap[openLen]);
      return;
    } catch (e) {}
  }

  match = aliasContent.exec(inner);
  if (match) {
    inner = match[1];
    alias = match[2];
  }

  match = blockContent.exec(inner)
  if (!match) return;
  hash = match[1];
  type = match[2];
  name = match[3];

  escaped = true;
  if (type === 'unescaped') {
    escaped = false;
    type = '';
  }
  if (bound) name = name.replace(/\bthis\b/, '.');
  return {
    pre: pre
  , post: post
  , bound: bound
  , alias: alias
  , hash: hash
  , type: type
  , name: name
  , escaped: escaped
  , source: text
  };
}

function matchBraces(text, num, i, openChar, closeChar) {
  var close, hasClose, hasOpen, open;
  i++;
  while (num) {
    close = text.indexOf(closeChar, i);
    open = text.indexOf(openChar, i);
    hasClose = ~close;
    hasOpen = ~open;
    if (hasClose && (!hasOpen || (close < open))) {
      i = close + 1;
      num--;
      continue;
    } else if (hasOpen) {
      i = open + 1;
      num++;
      continue;
    } else {
      return -1;
    }
  }
  return i;
}

var fnCall = /^([^(]+)\s*\(\s*([\s\S]*?)\s*\)\s*$/
  , argSeparator = /\s*([,(])\s*/g
  , notSeparator = /[^,\s]/g
  , notPathArg = /(?:^['"\d\-[{])|(?:^null$)|(?:^true$)|(?:^false$)/;

function fnArgs(inner) {
  var args = []
    , lastIndex = 0
    , match, end, last;
  while (match = argSeparator.exec(inner)) {
    if (match[1] === '(') {
      end = matchBraces(inner, 1, argSeparator.lastIndex, '(', ')');
      args.push(inner.slice(lastIndex, end));
      notSeparator.lastIndex = end;
      lastIndex = argSeparator.lastIndex =
        notSeparator.test(inner) ? notSeparator.lastIndex - 1 : end;
      continue;
    }
    args.push(inner.slice(lastIndex, match.index));
    lastIndex = argSeparator.lastIndex;
  }
  last = inner.slice(lastIndex);
  if (last) args.push(last);
  return args;
}

function fnCallError(name) {
  throw new Error('malformed view function call: ' + name);
}

function fnArgValue(view, ctx, model, name, arg) {
  var literal = literalValue(arg)
    , argIds, path, pathId;
  if (literal === undefined) {
    argIds = ctx.hasOwnProperty('$fnArgIds') ?
      ctx.$fnArgIds : (ctx.$fnArgIds = {});
    if (pathId = argIds[arg]) {
      path = model.__pathMap.paths[pathId];
    } else {
      path = ctxPath(view, ctx, arg);
      argIds[arg] = model.__pathMap.id(path);
    }
    return dataValue(view, ctx, model, path);
  }
  return literal;
}

function fnValue(view, ctx, model, name) {
  var match = fnCall.exec(name) || fnCallError(name)
    , fnName = match[1]
    , args = fnArgs(match[2])
    , fn, fnName, i;
  for (i = args.length; i--;) {
    args[i] = fnArgValue(view, ctx, model, name, args[i]);
  }
  if (!(fn = view.getFns[fnName])) {
    throw new Error('view function "' + fnName + '" not found for call: ' + name);
  }
  return fn.apply({view: view, ctx: ctx, model: model}, args);
}

function pathFnArgs(name, paths) {
  var match = fnCall.exec(name) || fnCallError(name)
    , args = fnArgs(match[2])
    , i, arg;
  if (paths == null) paths = [];
  for (i = args.length; i--;) {
    arg = args[i];
    if (notPathArg.test(arg)) continue;
    if (~arg.indexOf('(')) {
      pathFnArgs(arg, paths);
      continue;
    }
    paths.push(arg);
  }
  return paths;
}

var indexPlaceholder = /\$#/g;

function relativePath(ctx, i, remainder, noReplace) {
  var meta = ctx.$paths[i - 1] || []
    , base = meta[0]
    , name = base + remainder
    , offset, indices, index, placeholders

  // Replace `$#` segments in a path with the proper indicies
  if (!noReplace && (placeholders = name.match(indexPlaceholder))) {
    indices = ctx.$indices;
    index = placeholders.length + indices.length - meta[1] - 1;
    name = name.replace(indexPlaceholder, function() {
      return indices[--index];
    });
  }

  return name;
}

function trimWildcard(name) {
  if (name.charAt(name.length - 1) === '*') return name.slice(0, -1);
  return name;
}

function macroName(view, ctx, name) {
  if (name.charAt(0) !== '@') return;

  var segments = name.slice(1).split('.');
  var base = trimWildcard(segments.shift().toLowerCase());
  var value = lookup(base, ctx.$macroCtx);
  var matchName = value && value.$matchName;

  if (matchName) {
    var remainder = segments.join('.');
    if (!remainder) return value;
    return {$matchName: matchName + '.' + remainder};
  }
  return (remainder) ? base + '.' + remainder : base;
}

function ctxPath(view, ctx, name, noReplace) {
  var macroPath = macroName(view, ctx, name);
  if (macroPath && macroPath.$matchName) name = macroPath.$matchName;

  var firstChar = name.charAt(0)
    , i, aliasName, remainder

  // Resolve path aliases
  if (firstChar === ':') {
    if (~(i = name.search(/[.[]/))) {
      aliasName = name.slice(1, i);
      remainder = name.slice(i);
    } else {
      aliasName = name.slice(1);
      remainder = '';
    }
    aliasName = trimWildcard(aliasName);
    i = ctx.$paths.length - ctx.$aliases[aliasName];
    if (i !== i) throw new Error('Cannot find alias: ' + name);

    name = relativePath(ctx, i, remainder, noReplace);

  // Resolve relative paths
  } else if (firstChar === '.') {
    i = 0;
    while (name.charAt(i) === '.') {
      i++;
    }
    remainder = i === name.length ? '' : name.slice(i - 1);

    name = relativePath(ctx, i, remainder, noReplace);
  }

  return replaceSquareBrackets(view, ctx, name);
}

function replaceSquareBrackets(view, ctx, name) {
  var i = name.indexOf('[');
  if (i === -1) return name;

  var end = matchBraces(name, 1, i, '[', ']');
  // This shouldn't normally happen, but just in case return
  if (end === -1) return;
  var before = name.slice(0, i);
  var inside = name.slice(i + 1, end - 1);
  var after = name.slice(end);

  name = replaceSquareBrackets(view, ctx, inside);
  name = getValue(view, ctx, view.model, name);
  var out = (before) ? before + '.' + name : name;

  while (after) {
    i = after.indexOf('[');
    if (i === -1) return out + after;

    name = after;
    end = matchBraces(name, 1, i, '[', ']');
    if (end === -1) return;
    before = name.slice(0, i);
    inside = name.slice(i + 1, end - 1);
    after = name.slice(end);

    if (before) out += before;

    name = replaceSquareBrackets(view, ctx, inside);
    out += '.' + getValue(view, ctx, view.model, name);
  }
  return out;
}

function squareBracketsArgs(name, paths) {
  paths || (paths = []);

  while (name) {
    i = name.indexOf('[');
    if (i === -1) return paths;

    end = matchBraces(name, 1, i, '[', ']');
    if (end === -1) return paths;
    inside = name.slice(i + 1, end - 1);
    name = name.slice(end);

    if (inside.indexOf('[') === -1) {
      paths.push(inside);
    } else {
      squareBracketsArgs(inside, paths);
    }
  }
  return paths;
}

function escapeValue(value, escape) {
  return escape ? escape(value) : value;
}

function literalValue(value) {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  var firstChar = value.charAt(0)
    , match;
  if (firstChar === "'") {
    match = /^'(.*)'$/.exec(value) || fnCallError(value);
    return match[1];
  }
  if (firstChar === '"') {
    match = /^"(.*)"$/.exec(value) || fnCallError(value);
    return match[1];
  }
  if (/^[\d\-]/.test(firstChar) && !isNaN(value)) {
    return +value;
  }
  if (firstChar === '[' || firstChar === '{') {
    try {
      return JSON.parse(value);
    } catch (e) {}
  }
  return undefined;
}

function getValue(view, ctx, model, name, escape, forceEscape) {
  var literal = literalValue(name)
  if (literal === undefined) {
    return dataValue(view, ctx, model, name, escape, forceEscape);
  }
  return literal;
}

function dataValue(view, ctx, model, name, escape, forceEscape) {
  var macroPath, path, value;
  if (!name) return;
  if (~name.indexOf('(')) {
    value = fnValue(view, ctx, model, name);
    return escapeValue(value, escape);
  }
  path = ctxPath(view, ctx, name);
  macroPath = macroName(view, ctx, path);
  if (macroPath) {
    if (macroPath.$matchName) {
      path = macroPath.$matchName;
    } else {
      value = lookup(macroPath, ctx.$macroCtx);
      if (typeof value === 'function') {
        if (value.unescaped && !forceEscape) return value(ctx, model);
        value = value(ctx, model);
      }
      return escapeValue(value, escape);
    }
  }
  value = lookup(path, ctx);
  if (value === void 0) value = model.get(path)
  return escapeValue(value, escape);
}

function setBoundFn(view, ctx, model, name, value) {
  var match = fnCall.exec(name) || fnCallError(name)
    , fnName = match[1]
    , args = fnArgs(match[2])
    , get = view.getFns[fnName]
    , set = view.setFns[fnName]
    , numInputs = set && set.length - 1
    , arg, i, inputs, out, key, path, len;

  if (!(get && set)) {
    throw new Error('view function "' + fnName + '" setter not found for binding to: ' + name);
  }

  if (numInputs) {
    inputs = [value];
    i = 0;
    while (i < numInputs) {
      inputs.push(fnArgValue(view, ctx, model, name, args[i++]));
    }
    out = set.apply(null, inputs);
  } else {
    out = set(value);
  }
  if (!out) return;

  for (key in out) {
    value = out[key];
    arg = args[key];
    if (~arg.indexOf('(')) {
      setBoundFn(view, ctx, model, arg, value);
      continue;
    }
    if (value === void 0 || notPathArg.test(arg)) continue;
    path = ctxPath(view, ctx, arg);
    if (model.get(path) === value) continue;
    model.set(path, value);
  }
}

function patchCtx(ctx, triggerPath) {
  var meta, path;
  if (!(triggerPath && (meta = ctx.$paths[0]) && (path = meta[0]))) return;

  var segments = path.split('.')
    , triggerSegments = triggerPath.replace(/\*$/, '').split('.')
    , matchingIndices = []
    , indices = ctx.$indices.slice()
    , i, len, segment, triggerSegment, n;
  for (i = 0, len = segments.length; i < len; i++) {
    segment = segments[i];
    triggerSegment = triggerSegments[i];
    // `(n = +triggerSegment) === n` will be false only if segment is NaN
    if (segment === '$#' && (n = +triggerSegment) === n) {
      matchingIndices.push(n);
    } else if (segment !== triggerSegment) {
      break;
    }
  }
  var index = matchingIndices.length;
  for (i = 0, len = matchingIndices.length; i < len; i++) {
    indices[--index] = matchingIndices[i];
  }
  ctx.$indices = indices;
  ctx.$index = indices[0];
}

function lookup(path, obj) {
  if (!path || !obj) return;
  if (path.indexOf('.') === -1) return obj[path];

  var parts = path.split('.');
  for (var i = 0, l = parts.length; i < l; i++) {
    if (!obj) return obj;

    var prop = parts[i];
    obj = obj[prop];
  }
  return obj;
}
