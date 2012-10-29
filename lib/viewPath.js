// Used by [`View`](View.html) and [`eventBinding`](eventBinding.html) modules
// to retrieve data, referenced by path from model or context object, needed to
// render HTML from view templates.

// ## Dependencies
//
// `lookup(path, obj)` function is used to get value of a property accessible
// by `path` in `obj`.
//
// Path can be simple or segmented. Simple paths results in `obj[path]`. While
// segmented are a paths which uses `.` (dot character) to go deeper, e.g.
// `lookup('p1.p2.p3', { ... })` will return value of an `obj[p1][p2][p3]`.
var lookup = require('racer/lib/path').lookup
  , trimLeading = require('html-util').trimLeading;

// ## Exports
//
// Exports seven utility functions for dependant modules.
exports.wrapRemainder = wrapRemainder;
exports.extractPlaceholder = extractPlaceholder;
exports.pathFnArgs = pathFnArgs;
exports.isBound = isBound;
exports.ctxPath = ctxPath;
exports.dataValue = dataValue;
exports.setBoundFn = setBoundFn;

function wrapRemainder(tagName, remainder) {
  if (!remainder) return false;
  return !(new RegExp('^<\/' + tagName, 'i')).test(remainder);
}

var openPlaceholder = /^([\s\S]*?)(\{{1,3})\s*([\s\S]*)/
  , placeholderContent = /^([\#\/]?)(?:(else\sif|if|else|unless|each|with|unescaped)(?!\())?\s*([^\s(>]*(?:\s*\([\s\S]*\))?)(?:\s+as\s+:([^\s>]+))?/
  , closeMap = { 1: '}', 2: '}}', 3: '}}}' }
function extractPlaceholder(text) {
  var match = openPlaceholder.exec(text);
  if (!match) return;
  var pre = match[1]
    , open = match[2]
    , remainder = match[3]
    , openLen = open.length
    , bound = openLen === 1
    , macro = openLen === 3
    , end = matchBraces(remainder, openLen, 0, '{', '}')
    , endInner = end - openLen
    , inner = remainder.slice(0, endInner)
    , post = remainder.slice(end)
    , content = placeholderContent.exec(inner)
    , escaped, name, type;
  if (!content) return;
  if (/["{[]/.test(inner)) {
    // Make sure that we didn't accidentally match a JSON literal
    try {
      JSON.parse(open + inner + closeMap[openLen]);
      return;
    } catch (e) {}
  }
  type = content[2];
  escaped = true;
  if (type === 'unescaped') {
    escaped = false;
    type = '';
  }
  name = content[3];
  if (bound) name = name.replace(/\bthis\b/, '.');
  return {
    pre: trimLeading(pre)
  , post: trimLeading(post)
  , bound: bound
  , macro: macro
  , hash: content[1]
  , escaped: escaped
  , type: type
  , name: name
  , alias: content[4]
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
      return;
    }
  }
  return i;
}

var fnCall = /^([^(]+)\s*\(\s*([\s\S]*?)\s*\)\s*$/
  , argSeparator = /\s*([,(])\s*/g
  , notSeparator = /[^,\s]/g
  , notPathArg = /(?:^['"\d\-[{])|(?:^null$)|(?:^true$)|(?:^false$)/;


// Return an Array instance containing arguments from `inner`
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
  // TODO: error text is confusing when called from `fnLiteralValue` function
  throw new Error('malformed view function call: ' + name);
}

// Convert string representation of a literal to an actual JavaScript literal.
// Not exported, used only by `fnArgValue` function.
function fnLiteralValue(arg) {
  if (arg === 'null') return null;
  if (arg === 'true') return true;
  if (arg === 'false') return false;

  // Throw a TypeError if `arg` is not a String
  var firstChar = arg.charAt(0)
    , match;

  // Throw Error if `arg` represents string (i.e. starts with ' or " marks) and
  // does not have closing quotation mark.
  if (firstChar === "'") {
    match = /^'(.*)'$/.exec(arg) || fnCallError(arg);
    return match[1];
  }
  if (firstChar === '"') {
    match = /^"(.*)"$/.exec(arg) || fnCallError(arg);
    return match[1];
  }

  // Return `undefined` if `arg` starts as a number but actually is a NaN (e.g.
  // `98k` or `-1m`); or if a JSON serialized array or object fails to parse.
  if (/^[\d\-]/.test(firstChar) && !isNaN(arg)) {
    return +arg;
  }
  if (firstChar === '[' || firstChar === '{') {
    try {
      return JSON.parse(arg);
    } catch (e) {}
  }
  return undefined;
}

function fnArgValue(view, ctx, model, name, macro, arg) {
  var literal = fnLiteralValue(arg)
    , argIds, path, pathId;

  // Retview value of an argument from model if `arg` is an identifier (i.e.
  // not a JavaScript literal).
  if (literal === undefined) {
    argIds = ctx.hasOwnProperty('$fnArgIds') ?
      ctx.$fnArgIds : (ctx.$fnArgIds = {});

    // Lookup `ctx.$fnArgIds` hash table for path's ID of a given `arg`. Or
    // construct path and store mapping between it and `arg` to the
    // `ctx.$fnArgIds` object if mapping does not already exists.
    if (pathId = argIds[arg]) {
      path = model.__pathMap.paths[pathId];
    } else {
      path = ctxPath(view, ctx, arg, macro);
      argIds[arg] = model.__pathMap.id(path);
    }
    return dataValue(view, ctx, model, path, macro);
  }

  // Return JavaScript literal when `arg` can be validly converted to it.
  return literal;
}

// Evaluate function referenced in `name` and return it's value
//
// `name` is a *function call* string, e.g. `funcName (arg1, arg2)`
//
// Error will be thrown if `name` contains malformed *function call* or if the
// referenced function does not defined on `view`.
function fnValue(view, ctx, model, name, macro) {
  var match = fnCall.exec(name) || fnCallError(name)
    , fnName = match[1]
    , args = fnArgs(match[2])
    , fn, fnName, i;
  for (i = args.length; i--;) {
    args[i] = fnArgValue(view, ctx, model, name, macro, args[i]);
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

function isBoundMacroAttr(macroAttrs, name) {
  var macroVar = name.split('.')[0]
    , attr = macroAttrs && macroAttrs[macroVar];
  return attr && attr.$bound;
}

function isBound(macroAttrs, match) {
  if (match.bound) return true;
  if (!match.macro || !macroAttrs) return false;
  var name = match.name;
  if (~name.indexOf('(')) {
    var args = pathFnArgs(name)
      , i, len;
    for (i = 0, len = args.length; i < len; i++) {
      if (isBoundMacroAttr(macroAttrs, args[i])) return true;
    }
    return false;
  }
  return isBoundMacroAttr(macroAttrs, name);
}

function macroName(view, ctx, name, noReplace) {
  var macroCtx = ctx.$macroCtx
    , path = ctxPath(view, macroCtx, name, false, noReplace)
    , segments = path.split('.')
    , base = segments[0].toLowerCase()
    , remainder = segments[1]
    , value = lookup(base, macroCtx)
    , matchName = value && value.$matchName;
  if (!matchName) return remainder ? base + '.' + remainder : base;
  return remainder ?
    (/\.+/.test(matchName) ? matchName.slice(1) : matchName) + '.' + remainder :
    matchName;
}

var indexPlaceholder = /\$#/g;

function relativePath(ctx, i, remainder, noReplace) {
  var meta = ctx.$paths[i - 1]
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

function ctxPath(view, ctx, name, macro, noReplace) {
  if (macro) name = macroName(view, ctx, name, noReplace);

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
    i = ctx.$paths.length - ctx.$aliases[aliasName];
    if (i !== i) throw new Error('Cannot find alias for ' + aliasName);

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

  // Perform path interpolation
  return name.replace(/\[([^\]]+)\]/g, function(match, name, offset) {
    return (offset ? '.' : '') + dataValue(view, ctx, view.model, name);
  });
}

// Return a value of a variable referenced by `name` from a view template.
function dataValue(view, ctx, model, name, macro) {
  var path, value;

  // Evaluate `name` as a *function call* string if it contains `(` character.
  if (~name.indexOf('(')) {
    return fnValue(view, ctx, model, name, macro);
  }
  if (macro) {
    // Get macro content sections
    value = lookup(name.toLowerCase(), ctx.$macroCtx);
    if (value && !value.$matchName) {
      return typeof value === 'function' ? value(ctx, model) : value;
    }
  }
  path = ctxPath(view, ctx, name, macro);

  // First lookup for a path in a context object and then in a model.
  value = lookup(path, ctx);
  if (value !== void 0) return value;
  value = model.get(path);
  return value !== void 0 ? value : model[path];
}

function setBoundFn(view, ctx, model, name, value) {
  var match = fnCall.exec(name) || fnCallError(name)
    , fnName = match[1]
    , args = fnArgs(match[2])
    , get = view.getFns[fnName]
    , set = view.setFns[fnName]
    , macro = false
    , numInputs = set.length - 1
    , arg, i, inputs, out, path, len;

  if (!(get && set)) {
    throw new Error('view function "' + fnName + '" not found for binding to: ' + name);
  }

  if (numInputs) {
    inputs = [value];
    i = 0;
    while (i < numInputs) {
      inputs.push(fnArgValue(view, ctx, model, name, macro, args[i++]));
    }
    out = set.apply(null, inputs);
  } else {
    out = set(value);
  }
  if (!out) return;

  for (i = 0, len = out.length; i < len; i++) {
    value = out[i];
    arg = args[i + numInputs];
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
