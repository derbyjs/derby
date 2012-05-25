var lookup = require('racer/lib/path').lookup
  , trimLeading = require('html-util').trimLeading;

exports.wrapRemainder = wrapRemainder;
exports.extractPlaceholder = extractPlaceholder;
exports.pathFnArgs = pathFnArgs;
exports.ctxPath = ctxPath;
exports.dataValue = dataValue;
exports.setBoundFn = setBoundFn;

function wrapRemainder(tagName, remainder) {
  if (!remainder) return false;
  return !(new RegExp('^<\/' + tagName, 'i')).test(remainder);
}

var openPlaceholder = /^([\s\S]*?)(\{{1,3})([\s\S]*)/
  , placeholderContent = /^\s*([\#\/]?)(?:(else\sif|if|else|unless|each|with|unescaped)(?!\())?\s*([^\s(>]*(?:\s*\([\s\S]*\))?)(?:\s+as\s+:([^\s>]+))?/;

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

function fnArgValue(view, ctx, model, name, macro, arg) {
  if (arg === 'null') return null;
  if (arg === 'true') return true;
  if (arg === 'false') return false;
  var firstChar = arg.charAt(0)
    , match;
  if (firstChar === "'") {
    match = /^'(.*)'$/.exec(arg) || fnCallError(name);
    return match[1];
  }
  if (firstChar === '"') {
    match = /^"(.*)"$/.exec(arg) || fnCallError(name);
    return match[1];
  }
  if (/^[\d\-]/.test(firstChar) && !isNaN(arg)) {
    return +arg;
  }
  if (firstChar === '[' || firstChar === '{') {
    throw new Error('object literals not supported in view function call: ' + name);
  }
  return dataValue(view, ctx, model, arg, macro);
}

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
  return fn.apply(null, args);
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

function macroName(ctx, name, noReplace) {
  var macroCtx = ctx.$macroCtx
    , path = ctxPath(macroCtx, name, false, noReplace)
    , segments = path.split('.')
    , base = segments[0].toLowerCase()
    , remainder = segments[1]
    , value = lookup(base, macroCtx)
    , macroVar = value && value.$macroVar;
  if (!macroVar) return remainder ? base + '.' + remainder : base;
  return remainder ?
    (/\.+/.test(macroVar) ? macroVar.slice(1) : macroVar) + '.' + remainder :
    macroVar;
}

function ctxPath(ctx, name, macro, noReplace) {
  if (macro) name = macroName(ctx, name, noReplace);

  var firstChar = name.charAt(0)
    , i, startingDepth, aliasName, firstChar, indices;
  if (firstChar === ':') {
    if (~(i = name.indexOf('.'))) {
      aliasName = name.slice(1, i);
      name = name.slice(i);
    } else {
      aliasName = name.slice(1);
      name = '';
    }
    startingDepth = ctx.$aliases[aliasName];
    i = ctx.$depth - startingDepth;
    if (i !== i) throw new Error("Can't find alias for " + aliasName);
  } else if (firstChar === '.') {
    i = 0;
    while (name.charAt(i) === '.') {
      i++;
    }
    name = i === name.length ? '' : name.slice(i - 1);
  }
  if (i && (name = ctx.$paths[i - 1] + name) && !noReplace) {
    indices = ctx.$indices;
    i = indices.length - (startingDepth || 0);
    name = name.replace(/\$#/g, function() {
      return indices[--i];
    });
  }
  return name.replace(/\[([^\]]+)\]/g, function(match, name) {
    return lookup(name, ctx);
  });
}

function dataValue(view, ctx, model, name, macro) {
  var path, value;
  if (~name.indexOf('(')) {
    return fnValue(view, ctx, model, name, macro);
  }
  if (macro) {
    // Get macro content sections
    value = lookup(name.toLowerCase(), ctx.$macroCtx);
    if (value && !value.$macroVar) {
      return typeof value === 'function' ? value(ctx, model) : value;
    }
  }
  path = ctxPath(ctx, name, macro);
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
    path = ctxPath(ctx, arg);
    if (model.get(path) === value) continue;
    model.set(path, value);
  }
}
