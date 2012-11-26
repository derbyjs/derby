var htmlUtil = require('html-util')
  , md5 = require('MD5')
  , parseHtml = htmlUtil.parse
  , trimLeading = htmlUtil.trimLeading
  , unescapeEntities = htmlUtil.unescapeEntities
  , escapeHtml = htmlUtil.escapeHtml
  , escapeAttribute = htmlUtil.escapeAttribute
  , isVoid = htmlUtil.isVoid
  , conditionalComment = htmlUtil.conditionalComment
  , lookup = require('racer/lib/path').lookup
  , markup = require('./markup')
  , viewPath = require('./viewPath')
  , wrapRemainder = viewPath.wrapRemainder
  , ctxPath = viewPath.ctxPath
  , extractPlaceholder = viewPath.extractPlaceholder
  , dataValue = viewPath.dataValue
  , pathFnArgs = viewPath.pathFnArgs
  , racer = require('racer')
  , merge = racer.util.merge

module.exports = View;

function empty() {
  return '';
}

function notFound(name, ns) {
  if (ns) name = ns + ':' + name;
  throw new Error("Can't find view: " + name);
}

var defaultCtx = {
  $aliases: {}
, $paths: []
, $indices: []
};

var defaultGetFns = {
  equal: function(a, b) {
    return a === b;
  }
, not: function(value) {
    return !value;
  }
, join: function(items, property, separator) {
    var list, i;
    if (!items) return;
    if (property) {
      list = [];
      for (i = items.length; i--;) {
        list[i] = items[i][property];
      }
    } else {
      list = items;
    }
    return list.join(separator || ', ');
  }
, log: function(value) {
    console.log.apply(console, arguments);
    return value;
  }
, path: function(name) {
    return ctxPath(this.view, this.ctx, name);
  }
};

var defaultSetFns = {
  equal: function(value, a) {
    return value ? [a] : [];
  }
, not: function(value) {
    return [!value];
  }
};

function View(libraries, appExports) {
  this._libraries = libraries || [];
  this._appExports = appExports;
  this._inline = '';
  this.clear();
  this.getFns = Object.create(defaultGetFns);
  this.setFns = Object.create(defaultSetFns);
}
View.prototype = {
  defaultViews: {
    doctype: function() {
      return '<!DOCTYPE html>';
    }
  , root: empty
  , charset: function() {
      return '<meta charset=utf-8>';
    }
  , title$s: empty
  , head: empty
  , header: empty
  , body: empty
  , footer: empty
  , scripts: empty
  , tail: empty
  }

, _selfNs: 'app'

  // All automatically created ids start with a dollar sign
  // TODO: change this since it messes up query selectors unless escaped
, _uniqueId: uniqueId

, clear: clear
, _resetForRender: resetForRender
, make: make
, _makeAll: makeAll
, _makeComponents: makeComponents
, _findView: findView
, _find: find
, get: get
, fn: fn
, render: render
, componentsByName: componentsByName
, _beforeRender: beforeRender
, _afterRender: afterRender

, inline: empty

, escapeHtml: escapeHtml
, escapeAttribute: escapeAttribute

, _valueText: valueText
}

function clear() {
  this._views = Object.create(this.defaultViews);
  this._renders = {};
  this._resetForRender();
}

function resetForRender(model, componentInstances) {
  componentInstances || (componentInstances = {});
  if (model) this.model = model;
  this._idCount = 0;
  this._componentInstances = componentInstances;
  var libraries = this._libraries
    , i, library
  for (i = libraries.length; i--;) {
    libraries[i].view._resetForRender(model, componentInstances);
  }
}

function componentsByName(name) {
  return this._componentInstances[name];
}

function uniqueId() {
  return '$' + (this._idCount++).toString(36);
}

function make(name, template, options, templatePath) {
  var view = this
    , onBind, renderer, render, matchTitle, isString;

  if (templatePath && (render = this._renders[templatePath])) {
    this._views[name] = render;
    return
  }

  name = name.toLowerCase();
  matchTitle = /(?:^|\:)title(\$s)?$/.exec(name);
  if (matchTitle) {
    isString = !!matchTitle[1];
    if (isString) {
      onBind = function(events, name) {
        return bindEvents(events, name, render, ['$_doc', 'prop', 'title']);
      };
    } else {
      this.make(name + '$s', template, options, templatePath);
    }
  }

  renderer = function(ctx, model, triggerPath, triggerId) {
    renderer = parse(view, name, template, isString, onBind);
    return renderer(ctx, model, triggerPath, triggerId);
  }
  render = function(ctx, model, triggerPath, triggerId) {
    return renderer(ctx, model, triggerPath, triggerId);
  }

  render.nonvoid = options && 'nonvoid' in options;

  this._views[name] = render;
  if (templatePath) this._renders[templatePath] = render;
}

function makeAll(templates, instances) {
  var name, instance, options, templatePath;
  if (!instances) return;
  this.clear();
  for (name in instances) {
    instance = instances[name];
    templatePath = instance[0];
    options = instance[1];
    this.make(name, templates[templatePath], options, templatePath);
  }
}

function makeComponents(components) {
  var librariesMap = this._libraries.map
    , name, component, library;
  for (name in components) {
    component = components[name];
    library = librariesMap[name];
    library && library.view._makeAll(component.templates, component.instances);
  }
}

function findView(name, ns) {
  var items = this._views
    , item, i, segments, testNs;
  name = name.toLowerCase();
  if (ns) {
    ns = ns.toLowerCase();
    item = items[ns + ':' + name];
    if (item) return item;

    segments = ns.split(':');
    for (i = segments.length; i-- > 1;) {
      testNs = segments.slice(0, i).join(':');
      item = items[testNs + ':' + name];
      if (item) return item;
    }
  }
  return items[name];
}

function find(name, ns) {
  return this._findView(name, ns) || notFound(name, ns);
}

function get(name, ns, ctx) {
  if (typeof ns === 'object') {
    ctx = ns;
    ns = '';
  }
  ctx = ctx ? extend(ctx, defaultCtx) : Object.create(defaultCtx);
  ctx.$fnCtx = [this._appExports];
  return this._find(name, ns)(ctx);
}

function fn(name, value) {
  if (typeof name === 'object') {
    for (var k in name) {
      this.fn(k, name[k]);
    }
    return;
  }
  var get, set;
  if (typeof value === 'object') {
    get = value.get;
    set = value.set;
  } else {
    get = value;
  }
  this.getFns[name] = get;
  if (set) this.setFns[name] = set;
}

function emitRender(app, ns, ctx, name) {
  if (!app) return;
  app.emit(name, ctx);
  if (ns) app.emit(name + ':' + ns, ctx);
}
function beforeRender(ns, ctx) {
  ctx = (ctx && Object.create(ctx)) || {};
  ctx.$ns = ns;
  emitRender(this._appExports, ns, ctx, 'pre:render');
  return ctx;
}
function afterRender(ns, ctx) {
  this.dom._preventUpdates = false;
  this.dom._emitUpdate();
  emitRender(this._appExports, ns, ctx, 'render');
}

function render(model, ns, ctx, renderHash) {
  if (typeof ns === 'object') {
    rendered = ctx;
    ctx = ns;
    ns = '';
  }
  this.model = model;
  var dom = this.dom
    , lastRender = this._lastRender

  dom._preventUpdates = true;

  if (lastRender) {
    emitRender(this._appExports, lastRender.ns, lastRender.ctx, 'replace');
  }
  if (!renderHash) ctx = this._beforeRender(ns, ctx);
  this._lastRender = {
    ns: ns
  , ctx: ctx
  };

  this._resetForRender();
  dom.clear();
  model.__pathMap.clear();
  model.__events.clear();
  model.__blockPaths = {};
  model.del('_$component');

  var title = this.get('title$s', ns, ctx)
    , rootHtml = this.get('root', ns, ctx)
    , bodyHtml = this.get('header', ns, ctx) +
        this.get('body', ns, ctx) +
        this.get('footer', ns, ctx)
    , doc = window.document
    , err

  if (renderHash) {
    if (renderHash === md5(bodyHtml)) return;
    err = new Error('Server and client page renders do not match');
    setTimeout(function() {
      throw err;
    }, 0);
  }

  var documentElement = doc.documentElement
    , attrs = documentElement.attributes
    , i, attr, fakeRoot, body;

  // Remove all current attributes on the documentElement and replace
  // them with the attributes in the rendered rootHtml
  for (i = attrs.length; i--;) {
    attr = attrs[i];
    documentElement.removeAttribute(attr.name);
  }
  // Using the DOM to get the attributes on an <html> tag would require
  // some sort of iframe hack until DOMParser has better browser support.
  // String parsing the html should be simpler and more efficient
  parseHtml(rootHtml, {
    start: function(tag, tagName, attrs) {
      if (tagName !== 'html') return;
      for (var attr in attrs) {
        documentElement.setAttribute(attr, attrs[attr]);
      }
    }
  });

  fakeRoot = doc.createElement('html');
  fakeRoot.innerHTML = bodyHtml;
  body = fakeRoot.getElementsByTagName('body')[0];
  documentElement.replaceChild(body, doc.body);
  doc.title = title;

  this._afterRender(ns, ctx);
}


function extend(parent, obj) {
  var out = Object.create(parent)
    , key;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return out;
  }
  for (key in obj) {
    out[key] = obj[key];
  }
  return out;
}

function modelListener(params, triggerId, blockPaths, pathId, partial, ctx) {
  var listener = typeof params === 'function'
    ? params(triggerId, blockPaths, pathId)
    : params;
  listener.partial = partial;
  listener.ctx = ctx.$stringCtx || ctx;
  return listener;
}

function bindEvents(events, name, partial, params) {
  if (~name.indexOf('(')) {
    var args = pathFnArgs(name);
    if (!args.length) return;
    events.push(function(ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId) {
      var listener = modelListener(params, triggerId, blockPaths, null, partial, ctx)
        , path, pathId, i;
      listener.getValue = function(model, triggerPath) {
        patchCtx(ctx, triggerPath);
        return dataValue(view, ctx, model, name);
      }
      for (i = args.length; i--;) {
        path = ctxPath(view, ctx, args[i]);
        pathId = pathMap.id(path + '*');

        modelEvents.ids[path] = listener[0];
        modelEvents.bind(pathId, listener);
      }
    });
    return;
  }

  var match = /(\.*)(.*)/.exec(name)
    , prefix = match[1] || ''
    , relativeName = match[2] || ''
    , segments = relativeName.split('.')
    , bindName, i;
  for (i = segments.length; i; i--) {
    bindName = prefix + segments.slice(0, i).join('.');
    (function(bindName) {
      events.push(function(ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId) {
        var path = ctxPath(view, ctx, name)
          , listener, pathId;
        if (!path) return;
        pathId = pathMap.id(path);
        listener = modelListener(params, triggerId, blockPaths, pathId, partial, ctx);
        if (name !== bindName) {
          path = ctxPath(view, ctx, bindName);
          pathId = pathMap.id(path);
          listener.getValue = function(model, triggerPath) {
            patchCtx(ctx, triggerPath);
            return dataValue(view, ctx, model, name);
          };
        }

        modelEvents.ids[path] = listener[0];
        modelEvents.bind(pathId, listener);
      });
    })(bindName);
  }
}

function bindEventsById(events, name, partial, attrs, method, prop, blockType) {
  function params(triggerId, blockPaths, pathId) {
    var id = attrs._id || attrs.id;
    if (blockType && pathId) {
      blockPaths[id] = {id: pathId, type: blockType};
    }
    return [id, method, prop];
  }
  bindEvents(events, name, partial, params);
}

function bindEventsByIdString(events, name, partial, attrs, method, prop) {
  function params(triggerId) {
    var id = triggerId || attrs._id || attrs.id;
    return [id, method, prop];
  }
  bindEvents(events, name, partial, params);
}

function addId(view, attrs) {
  if (attrs.id == null) {
    attrs.id = function() {
      return attrs._id = view._uniqueId();
    };
  }
}

function pushValue(html, i, value, isAttr, isId) {
  if (typeof value === 'function') {
    var fn = isId ? function(ctx, model) {
      var id = value(ctx, model);
      html.ids[id] = i + 1;
      return id;
    } : value;
    i = html.push(fn, '') - 1;
  } else {
    if (isId) html.ids[value] = i + 1;
    html[i] += isAttr ? escapeAttribute(value) : value;
  }
  return i;
}

function reduceStack(stack) {
  var html = ['']
    , i = 0
    , attrs, bool, item, key, value, j, len;

  html.ids = {};

  for (j = 0, len = stack.length; j < len; j++) {
    item = stack[j];
    switch (item[0]) {
      case 'start':
        html[i] += '<' + item[1];
        attrs = item[2];
        // Make sure that the id attribute is rendered first
        if ('id' in attrs) {
          html[i] += ' id=';
          i = pushValue(html, i, attrs.id, true, true);
        }
        for (key in attrs) {
          if (key === 'id') continue;
          value = attrs[key];
          if (value != null) {
            if (bool = value.bool) {
              i = pushValue(html, i, bool);
              continue;
            }
            html[i] += ' ' + key + '=';
            i = pushValue(html, i, value, true);
          } else {
            html[i] += ' ' + key;
          }
        }
        html[i] += '>';
        break;
      case 'text':
        i = pushValue(html, i, item[1]);
        break;
      case 'end':
        html[i] += '</' + item[1] + '>';
        break;
      case 'marker':
        html[i] += '<!--' + item[1];
        i = pushValue(html, i, item[2].id, false, !item[1]);
        html[i] += '-->';
    }
  }
  return html;
}

function patchCtx(ctx, triggerPath) {
  var meta, path;
  if (!(triggerPath && (meta = ctx.$paths[0]) && (path = meta[0]))) return;

  var segments = path.split('.')
    , triggerSegments = triggerPath.replace(/\*$/, '').split('.')
    , indices = ctx.$indices.slice()
    , index = indices.length
    , i, len, segment, triggerSegment, n;
  for (i = 0, len = segments.length; i < len; i++) {
    segment = segments[i];
    triggerSegment = triggerSegments[i];
    // `(n = +triggerSegment) === n` will be false only if segment is NaN
    if (segment === '$#' && (n = +triggerSegment) === n) {
      indices[--index] = n;
    } else if (segment !== triggerSegment) {
      break;
    }
  }
  ctx.$indices = indices;
  ctx.$index = indices[0];
}

function renderer(view, items, events, onRender) {
  return function(ctx, model, triggerPath, triggerId) {
    patchCtx(ctx, triggerPath);

    if (!model) model = view.model;  // Needed, since model parameter is optional
    var pathMap = model.__pathMap
      , modelEvents = model.__events
      , blockPaths = model.__blockPaths
      , idIndices = items.ids
      , dom = view.dom
      , html = []
      , mutated = []
      , onMutator, i, len, item, event, pathIds, id, index;

    if (onRender) ctx = onRender(ctx);

    onMutator = model.on('mutator', function(method, args) {
      mutated.push(args[0][0])
    });

    for (i = 0, len = items.length; i < len; i++) {
      item = items[i];
      html[i] = (typeof item === 'function') ? item(ctx, model) || '' : item;
    }

    model.removeListener('mutator', onMutator)
    pathIds = modelEvents.ids = {}

    for (i = 0; event = events[i++];) {
      event(ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId);
    }

    // This detects when an already rendered bound value was later updated
    // while rendering the rest of the template. This can happen when performing
    // component initialization code.
    // TODO: This requires creating a whole bunch of extra objects every time
    // things are rendered. Should probably be refactored in a less hacky manner.
    for (i = 0, len = mutated.length; i < len; i++) {
      (id = pathIds[mutated[i]]) &&
      (index = idIndices[id]) &&
      (html[index] = items[index](ctx, model) || '')
    }

    return html.join('');
  }
}

function createComponent(view, model, Component, scope, ctx, macroCtx) {
  var dom = view.dom
    , scoped = model.at(scope)
    , prefix = scope + '.'
    , component = new Component(scoped)
    , parentFnCtx = model.__fnCtx || ctx.$fnCtx
    , fnCtx, i, key, path, value, instanceName, instances, parent, type;

  ctx.$fnCtx = model.__fnCtx = parentFnCtx.concat(component);

  // TODO: Could later be removed. This is only needed for the hack below
  scoped.set({});

  for (key in macroCtx) {
    value = macroCtx[key];
    if (value && value.$matchName) {
      path = ctxPath(view, ctx, value.$matchName);
      if (value.$bound) {
        model.ref(prefix + key, path, null, true);
        continue;
      }
      value = dataValue(view, ctx, model, path);
      model.set(prefix + key, value);
      continue;
    }
    if (typeof value === 'function') value = value(ctx, model);
    model.set(prefix + key, value);
  }

  instanceName = scoped.get('name');
  if (instanceName) {
    instances = view._componentInstances[instanceName] ||
      (view._componentInstances[instanceName] = []);
    instances.push(component);
  }

  if (component.init) component.init(scoped);

  parent = true;
  for (i = parentFnCtx.length; fnCtx = parentFnCtx[--i];) {
    type = Component.type(fnCtx.view);
    if (parent) {
      parent = false;
      fnCtx.emit('init:child', component, type);
    }
    fnCtx.emit('init:descendant', component, type);
    if (instanceName) {
      fnCtx.emit('init:' + instanceName, component, type);
    }
  }

  if (view.isServer) return;

  dom.nextUpdate(function() {
    var parent = true
      , type;
    for (i = parentFnCtx.length; fnCtx = parentFnCtx[--i];) {
      type = Component.type(fnCtx.view);
      if (parent) {
        parent = false;
        fnCtx.emit('create:child', component, type);
      }
      fnCtx.emit('create:descendant', component, type);
      if (instanceName) {
        fnCtx.emit('create:' + instanceName, component, type);
      }
    }
  });

  if (!component.create) return;

  dom.nextUpdate(function() {
    var componentDom = component.dom = dom.componentDom(ctx)
      , name;

    // TODO: This is a hack to correct for when components get created
    // multiple times during rendering. Should figure out something cleaner
    if (!scoped.get()) return;
    for (name in ctx.$elements) {
      if (!componentDom.element(name)) return;
      break;
    }

    component.create(scoped, componentDom);
  });

  return;
}

function extendCtx(view, ctx, value, name, alias, index, isArray) {
  var path = ctxPath(view, ctx, name, true)
    , aliases;
  ctx = extend(ctx, value);
  ctx['this'] = value;
  if (alias) {
    aliases = ctx.$aliases = Object.create(ctx.$aliases);
    aliases[alias] = ctx.$paths.length;
  }
  if (path) {
    ctx.$paths = [[path, ctx.$indices.length]].concat(ctx.$paths);
  }
  if (index != null) {
    ctx.$indices = [index].concat(ctx.$indices);
    ctx.$index = index;
    isArray = true;
  }
  if (isArray && ctx.$paths[0][0]) {
    ctx.$paths[0][0] += '.$#';
  }
  return ctx;
}

function partialValue(view, ctx, model, name, value, listener) {
  if (listener) return value;
  return name ? dataValue(view, ctx, model, name) : true;
}

function partialFn(view, name, type, alias, render, ns, macroCtx) {
  function conditionalRender(ctx, model, triggerPath, value, index, condition) {
    if (condition) {
      var renderCtx = extendCtx(view, ctx, value, name, alias, index, false);
      return render(renderCtx, model, triggerPath);
    }
    return '';
  }

  function withFn(ctx, model, triggerPath, triggerId, value, index, listener) {
    value = partialValue(view, ctx, model, name, value, listener);
    return conditionalRender(ctx, model, triggerPath, value, index, true);
  }

  if (type === 'partial') {
    return function(ctx, model, triggerPath, triggerId, value, index, listener) {
      // Inherit & render attribute context values
      var renderMacroCtx = {}
        , parentMacroCtx = ctx.$macroCtx
        , inherit = macroCtx.inherit
        , mergedMacroCtx, keys, key, i, val, matchName
      if (inherit) {
        mergedMacroCtx = merge({}, macroCtx);
        if (inherit === "*") {
          merge(mergedMacroCtx, parentMacroCtx);
        } else {
          keys = inherit.split(' ');
          for (i = keys.length; i--;) {
            key = keys[i];
            mergedMacroCtx[key] = parentMacroCtx[key];
          }
        }
        delete mergedMacroCtx.inherit;
      } else {
        mergedMacroCtx = macroCtx
      }
      for (key in mergedMacroCtx) {
        val = mergedMacroCtx[key];
        if (val && val.$matchName) {
          matchName = ctxPath(view, ctx, val.$matchName);
          if (matchName.charAt(0) === '@') {
            val = dataValue(view, ctx, model, matchName);
          } else {
            val = Object.create(val);
            val.$matchName = matchName;
          }
        }
        renderMacroCtx[key] = val;
      }

      // Find the appropriate partial template
      var partialNs, partialName, arr;
      if (name === 'get') {
        partialNs = mergedMacroCtx.ns || view._selfNs;
        partialName = mergedMacroCtx.view;
        if (!partialName) throw new Error('<get> tag without a "view" attribute')
        if (partialNs.$matchName) {
          partialNs = dataValue(view, ctx, model, partialNs.$matchName);
        }
        if (partialName.$matchName) {
          partialName = dataValue(view, ctx, model, partialName.$matchName);
        }
      } else {
        arr = splitPartial(name);
        partialNs = arr[0];
        partialName = arr[1];
      }
      var partialView = nsView(view, partialNs)
        , render = partialView._find(partialName, ns)
        , alias = partialView === view ? '' : 'self'
        , Component = alias && partialView._selfLibrary.constructors[partialName]
        , renderCtx, scope, out

      // Prepare the context for rendering
      if (Component) {
        scope = '_$component.' + model.id();
        renderCtx = extendCtx(view, ctx, null, scope, alias, null, false);
        renderCtx.$elements = {};
        createComponent(view, model, Component, scope, renderCtx, renderMacroCtx);
      } else {
        renderCtx = Object.create(ctx);
      }
      renderCtx.$macroCtx = renderMacroCtx;

      out = render(renderCtx, model, triggerPath);
      if (Component) model.__fnCtx = model.__fnCtx.slice(0, -1);
      return out;
    }
  }

  if (type === 'with' || type === 'else') {
    return withFn;
  }

  if (type === 'if' || type === 'else if') {
    return function(ctx, model, triggerPath, triggerId, value, index, listener) {
      value = partialValue(view, ctx, model, name, value, listener);
      var condition = !!(Array.isArray(value) ? value.length : value);
      return conditionalRender(ctx, model, triggerPath, value, index, condition);
    }
  }

  if (type === 'unless') {
    return function(ctx, model, triggerPath, triggerId, value, index, listener) {
      value = partialValue(view, ctx, model, name, value, listener);
      var condition = !(Array.isArray(value) ? value.length : value);
      return conditionalRender(ctx, model, triggerPath, value, index, condition);
    }
  }

  if (type === 'each') {
    return function(ctx, model, triggerPath, triggerId, value, index, listener) {
      var indices, isArray, item, out, renderCtx, i, len;
      value = partialValue(view, ctx, model, name, value, listener);
      isArray = Array.isArray(value);

      if (listener && !isArray) {
        return withFn(ctx, model, triggerPath, triggerId, value, index, true);
      }

      if (!isArray) return '';

      ctx = extendCtx(view, ctx, null, name, alias, null, true);

      out = '';
      indices = ctx.$indices;
      for (i = 0, len = value.length; i < len; i++) {
        item = value[i];
        renderCtx = extend(ctx, item);
        renderCtx['this'] = item;
        renderCtx.$indices = [i].concat(indices);
        renderCtx.$index = i;
        out += render(renderCtx, model, triggerPath);
      }
      return out;
    }
  }

  throw new Error('Unknown block type: ' + type);
}

var objectToString = Object.prototype.toString;
var arrayToString = Array.prototype.toString;

function valueText(value) {
  return typeof value === 'string' ? value :
    value == null ? '' :
    (value.toString === objectToString || value.toString === arrayToString) ?
    JSON.stringify(value) : value.toString();
}

function textFn(view, name, escape, force) {
  var filter = escape ? function(value) {
    return escape(valueText(value));
  } : valueText;
  return function(ctx, model) {
    return dataValue(view, ctx, model, name, filter, force);
  }
}

function sectionFn(view, queue) {
  var render = renderer(view, reduceStack(queue.stack), queue.events)
    , block = queue.block
    , type = block.type
    , out = partialFn(view, block.name, type, block.alias, render)
  out.type = type;
  return out;
}

function blockFn(view, sections) {
  var len = sections.length;
  if (!len) return;
  if (len === 1) {
    return sectionFn(view, sections[0]);

  } else {
    var fns = []
      , i, out;
    for (i = 0; i < len; i++) {
      fns.push(sectionFn(view, sections[i]));
    }
    out = function(ctx, model, triggerPath, triggerId, value, index, listener) {
      var out, fn;
      for (i = 0; i < len; i++) {
        fn = fns[i];
        out = fn(ctx, model, triggerPath, triggerId, value, index, listener);
        if (out) return out;
      }
      return '';
    }
    out.type = 'multi';
    return out;
  }
}

function parseMarkup(type, attr, tagName, events, attrs, value) {
  var parser = markup[type][attr]
    , anyOut, anyParser, elOut, elParser, out;
  if (!parser) return;
  if (anyParser = parser['*']) {
    anyOut = anyParser(events, attrs, value);
  }
  if (elParser = parser[tagName]) {
    elOut = elParser(events, attrs, value);
  }
  out = anyOut ? extend(anyOut, elOut) : elOut;
  if (out && out.del) delete attrs[attr];
  return out;
}

function pushText(stack, text) {
  if (text) stack.push(['text', text]);
}

function pushVarFn(view, stack, fn, name, escapeFn) {
  if (fn) {
    pushText(stack, fn);
  } else {
    pushText(stack, textFn(view, name, escapeFn));
  }
}

function isPartial(view, tagName) {
  if (tagName === 'get') return true;
  var tagNs = splitPartial(tagName)[0];
  return (tagNs === view._selfNs || !!view._libraries.map[tagNs]);
}

function isPartialSection(tagName) {
  return tagName.charAt(0) === '@';
}

function partialSectionName(tagName) {
  return isPartialSection(tagName) ? tagName.slice(1) : null;
}

function nsView(view, ns) {
  if (ns === view._selfNs) return view;
  var partialView = view._libraries.map[ns].view;
  partialView._uniqueId = function() {
    return view._uniqueId();
  };
  partialView.model = view.model;
  partialView.dom = view.dom;
  return partialView;
}

function splitPartial(partial) {
  var i = partial.indexOf(':')
    , partialNs = partial.slice(0, i)
    , partialName = partial.slice(i + 1)
  return [partialNs, partialName];
}

function findComponent(view, partial, ns) {
  var arr = splitPartial(partial)
    , partialNs = arr[0]
    , partialName = arr[1]
    , partialView = nsView(view, partialNs)
  return partialView._find(partialName, ns);
}

function isVoidComponent(view, partial, ns) {
  if (partial === 'get') return true;
  return !findComponent(view, partial, ns).nonvoid;
}

function pushVar(view, ns, stack, events, remainder, match, fn) {
  var name = match.name
    , partial = match.partial
    , escapeFn = match.escaped && escapeHtml
    , attr, attrs, boundOut, last, tagName, wrap;

  if (partial) {
    fn = partialFn(view, partial, 'partial', null, null, ns, match.macroCtx);
  }

  else if (match.bound) {
    last = lastItem(stack);
    wrap = match.pre ||
      !last ||
      (last[0] !== 'start') ||
      isVoid(tagName = last[1]) ||
      wrapRemainder(tagName, remainder);

    if (wrap) {
      stack.push(['marker', '', attrs = {}]);
    } else {
      attrs = last[2];
      for (attr in attrs) {
        parseMarkup('boundParent', attr, tagName, events, attrs, match);
      }
      boundOut = parseMarkup('boundParent', '*', tagName, events, attrs, match);
      if (boundOut) {
        bindEventsById(events, name, null, attrs, boundOut.method, boundOut.property);
      }
    }
    addId(view, attrs);

    if (!boundOut) {
      bindEventsById(events, name, fn, attrs, 'html', !fn && escapeFn, match.type);
    }
  }

  pushVarFn(view, stack, fn, name, escapeFn);
  if (wrap) {
    stack.push([
      'marker'
    , '$'
    , { id: function() { return attrs._id } }
    ]);
  }
}

function pushVarString(view, ns, stack, events, remainder, match, fn) {
  var name = match.name
    , escapeFn = !match.escaped && unescapeEntities;
  function bindOnce(ctx) {
    ctx.$onBind(events, name);
    bindOnce = empty;
  }
  if (match.bound) {
    events.push(function(ctx) {
      bindOnce(ctx);
    });
  }
  pushVarFn(view, stack, fn, name, escapeFn);
}

function parseMatchError(text, message) {
  throw new Error(message + '\n\n' + text + '\n');
}

function onBlock(start, end, block, queues, callbacks) {
  var lastQueue, queue;
  if (end) {
    lastQueue = queues.pop();
    queue = lastItem(queues);
    queue.sections.push(lastQueue);
  } else {
    queue = lastItem(queues);
  }

  if (start) {
    queue = {
      stack: []
    , events: []
    , block: block
    , sections: []
    };
    queues.push(queue);
    callbacks.onStart(queue);
  } else {
    if (end) {
      callbacks.onStart(queue);
      callbacks.onEnd(queue.sections);
      queue.sections = [];
    } else {
      callbacks.onContent(block);
    }
  }
}

function parseMatch(text, match, queues, callbacks) {
  var hash = match.hash
    , type = match.type
    , name = match.name
    , block = lastItem(queues).block
    , blockType = block && block.type
    , startBlock, endBlock;

  if (type === 'if' || type === 'unless' || type === 'each' || type === 'with') {
    if (hash === '#') {
      startBlock = true;
    } else if (hash === '/') {
      endBlock = true;
    } else {
      parseMatchError(text, type + ' blocks must begin with a #');
    }

  } else if (type === 'else' || type === 'else if') {
    if (hash) {
      parseMatchError(text, type + ' blocks may not start with ' + hash);
    }
    if (blockType !== 'if' && blockType !== 'else if' &&
        blockType !== 'unless' && blockType !== 'each') {
      parseMatchError(text, type + ' may only follow `if`, `else if`, `unless`, or `each`');
    }
    startBlock = true;
    endBlock = true;

  } else if (hash === '/') {
    endBlock = true;

  } else if (hash === '#') {
    parseMatchError(text, '# must be followed by `if`, `unless`, `each`, or `with`');
  }

  if (endBlock && !block) {
    parseMatchError(text, 'Unmatched template end tag');
  }

  onBlock(startBlock, endBlock, match, queues, callbacks);
}

function parseAttr(view, viewName, events, tagName, attrs, attr) {
  var value = attrs[attr];
  if (typeof value === 'function') return;

  var attrOut = parseMarkup('attr', attr, tagName, events, attrs, value) || {}
    , boundOut, match, name, render, method, property;
  if (attrOut.addId) addId(view, attrs);

  if (match = extractPlaceholder(value)) {
    name = match.name;

    if (match.pre || match.post) {
      // Attributes must be a single string, so create a string partial
      addId(view, attrs);
      render = parse(view, viewName, value, true, function(events, name) {
        bindEventsByIdString(events, name, render, attrs, 'attr', attr);
      });

      attrs[attr] = attr === 'id' ? function(ctx, model) {
        return attrs._id = escapeAttribute(render(ctx, model));
      } : function(ctx, model) {
        return escapeAttribute(render(ctx, model));
      }
      return;
    }

    if (match.bound) {
      boundOut = parseMarkup('bound', attr, tagName, events, attrs, match) || {};
      addId(view, attrs);
      method = boundOut.method || 'attr';
      property = boundOut.property || attr;
      bindEventsById(events, name, null, attrs, method, property);
    }

    if (!attrOut.del) {
      attrs[attr] = attrOut.bool ? {
        bool: function(ctx, model) {
          return (dataValue(view, ctx, model, name)) ? ' ' + attr : '';
        }
      } : textFn(view, name, escapeAttribute, true);
    }
  }
}

function parsePartialAttr(view, viewName, events, attrs, attr) {
  var value = attrs[attr]
    , match;
  if (attr === 'content') {
    throw new Error('components may not have an attribute named "content"');
  }

  if (!value) {
    // A true boolean attribute will have a value of null
    if (value === null) attrs[attr] = true;
    return;
  }

  if (match = extractPlaceholder(value)) {
    // This attribute needs to be treated as a section
    if (match.pre || match.post) return true;

    attrs[attr] = {$matchName: match.name, $bound: match.bound};

  } else if (value === 'true') {
    attrs[attr] = true;
  } else if (value === 'false') {
    attrs[attr] = false;
  } else if (value === 'null') {
    attrs[attr] = null;
  } else if (!isNaN(value)) {
    attrs[attr] = +value;
  } else if (/^[{[]/.test(value)) {
    try {
      attrs[attr] = JSON.parse(value)
    } catch (err) {}
  }
}

function lastItem(arr) {
  return arr[arr.length - 1];
}

function parse(view, viewName, template, isString, onBind) {
  var queues, stack, events, onRender, push;

  queues = [{
    stack: stack = []
  , events: events = []
  , sections: []
  }];

  function onStart(queue) {
    stack = queue.stack;
    events = queue.events;
  }

  if (isString) {
    push = pushVarString;
    onRender = function(ctx) {
      if (ctx.$stringCtx) return ctx;
      ctx = Object.create(ctx);
      ctx.$onBind = onBind;
      ctx.$stringCtx = ctx;
      return ctx;
    }
  } else {
    push = pushVar;
  }

  var index = viewName.lastIndexOf(':')
    , ns = ~index ? viewName.slice(0, index) : ''
    , minifyContent = true;

  function parseStart(tag, tagName, attrs) {
    var attr, block, out, parser, isSection, attrBlock
    if ('x-no-minify' in attrs) {
      delete attrs['x-no-minify'];
      minifyContent = false;
    } else {
      minifyContent = true;
    }

    if (isPartial(view, tagName)) {
      block = {
        partial: tagName
      , macroCtx: attrs
      };
      onBlock(true, false, block, queues, {onStart: onStart});

      for (attr in attrs) {
        isSection = parsePartialAttr(view, viewName, events, attrs, attr);
        if (!isSection) continue;
        attrBlock = {
          partial: '@' + attr
        , macroCtx: lastItem(queues).block.macroCtx
        };
        onBlock(true, false, attrBlock, queues, {onStart: onStart});
        parseText(attrs[attr]);
        parseEnd(tag, '@' + attr);
      }

      if (isVoidComponent(view, tagName, ns)) {
        onBlock(false, true, null, queues, {
          onStart: onStart
        , onEnd: function(queues) {
            push(view, ns, stack, events, '', block);
          }
        })
      }
      return;
    }

    if (isPartialSection(tagName)) {
      block = {
        partial: tagName
      , macroCtx: lastItem(queues).block.macroCtx
      };
      onBlock(true, false, block, queues, {onStart: onStart});
      return;
    }

    if (parser = markup.element[tagName]) {
      out = parser(events, attrs);
      if (out != null ? out.addId : void 0) {
        addId(view, attrs);
      }
    }

    for (attr in attrs) {
      parseAttr(view, viewName, events, tagName, attrs, attr);
    }
    stack.push(['start', tagName, attrs]);
  }

  function parseText(text, isRawText, remainder) {
    var match = extractPlaceholder(text)
      , post, pre;
    if (!match || isRawText) {
      if (minifyContent) {
        text = isString ? unescapeEntities(trimLeading(text)) : trimLeading(text);
      }
      pushText(stack, text);
      return;
    }

    pre = match.pre;
    post = match.post;
    if (isString) pre = unescapeEntities(pre);
    pushText(stack, pre);
    remainder = post || remainder;

    parseMatch(text, match, queues, {
      onStart: onStart
    , onEnd: function(sections) {
        var fn = blockFn(view, sections);
        push(view, ns, stack, events, remainder, sections[0].block, fn);
      }
    , onContent: function(match) {
        push(view, ns, stack, events, remainder, match);
      }
    });

    if (post) return parseText(post);
  }

  function parseEnd(tag, tagName) {
    var sectionName = partialSectionName(tagName)
      , endsPartial = isPartial(view, tagName)
      , ctxName = sectionName || endsPartial && 'content'
    if (endsPartial && isVoidComponent(view, tagName, ns)) {
      throw new Error('End tag "' + tag + '" is not allowed for void component')
    }
    if (ctxName) {
      onBlock(false, true, null, queues, {
        onStart: onStart
      , onEnd: function(queues) {
          var queue = queues[0]
            , block = queue.block
              // Note that the ctx will be one level too deep, so we use its
              // prototype when rendering the section
            , fn = renderer(view, reduceStack(queue.stack), queue.events, Object.getPrototypeOf)
          fn.unescaped = true;
          block.macroCtx[ctxName] = fn;
          if (sectionName) return;
          push(view, ns, stack, events, '', block);
        }
      })
      return;
    }
    stack.push(['end', tagName]);
  }

  if (isString) {
    parseText(template);
  } else {
    parseHtml(template, {
      start: parseStart
    , text: parseText
    , end: parseEnd
    , comment: function(tag) {
        if (conditionalComment(tag)) pushText(stack, tag);
      }
    , other: function(tag) {
        pushText(stack, tag);
      }
    });
  }
  return renderer(view, reduceStack(stack), events, onRender);
}
