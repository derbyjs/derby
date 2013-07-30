var htmlUtil = require('html-util')
var md5 = require('MD5')
var parseHtml = htmlUtil.parse
var trimText = htmlUtil.trimText
var unescapeEntities = htmlUtil.unescapeEntities
var escapeHtml = htmlUtil.escapeHtml
var escapeAttribute = htmlUtil.escapeAttribute
var isVoid = htmlUtil.isVoid
var conditionalComment = htmlUtil.conditionalComment
var markup = require('./markup')
var viewPath = require('./viewPath')
var wrapRemainder = viewPath.wrapRemainder
var ctxPath = viewPath.ctxPath
var extractPlaceholder = viewPath.extractPlaceholder
var dataValue = viewPath.dataValue
var pathFnArgs = viewPath.pathFnArgs
var isBound = viewPath.isBound
var eventBinding = require('./eventBinding')
var splitEvents = eventBinding.splitEvents
var fnListener = eventBinding.fnListener
var derby = require('./derby')

module.exports = View;

function empty() {
  return '';
}

var defaultCtx = {
  $aliases: {}
, $paths: []
, $indices: []
};

var CAMEL_REGEXP = /([a-z])([A-Z])/g;

var defaultGetFns = {
  equal: function getEqual(a, b) {
    return a === b;
  }
, not: function getNot(value) {
    return !value;
  }
, or: function getOr() {
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      if (arg) return arg;
    };
    return arg;
  }
, and: function getAnd() {
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      if (!arg) return arg;
    };
    return arg;
  }
, gt: function getGt(a, b) {
    return a > b;
  }
, lt: function getLt(a, b) {
    return a < b;
  }
, gte: function getGte(a, b) {
    return a >= b;
  }
, lte: function getLte(a, b) {
    return a <= b;
  }
, dash: function getDash(value) {
    return value && value
      .replace(/[:_\s]/g, '-')
      .replace(CAMEL_REGEXP, '$1-$2')
      .toLowerCase()
  }
, join: function getJoin(items, property, separator) {
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
, log: function getLog() {
    console.log.apply(console, arguments);
  }
, trace: function getTrace() {
    console.trace();
  }
, debugger: function getDebugger() {
    debugger;
  }
, path: function getPath(name) {
    return ctxPath(this.view, this.ctx, name);
  }
, noop: function noop() {}
, lookup: viewPath.lookup
};

var defaultSetFns = {
  equal: function setEqual(value, a, b) {
    return value && [b];
  }
, not: function setNot(value) {
    return [!value];
  }
};

function View(libraries, app, appFilename) {
  this._libraries = libraries || [];
  this.app = app || {};
  this._appFilename = appFilename;
  this._inline = '';
  this.clear();
  this.getFns = Object.create(defaultGetFns);
  this.setFns = Object.create(defaultSetFns);
  if (this._init) this._init();
  this._idCount = 0;
  this._uncreated = [];
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
, _componentConstructor: componentConstructor
, _flushUncreated: flushUncreated
, _beforeRender: beforeRender
, _afterRender: afterRender
, _beforeRoute: beforeRoute

, inline: empty

, escapeHtml: escapeHtml
, escapeAttribute: escapeAttribute
}

View.valueBinding = valueBinding;

function clear() {
  this._views = Object.create(this.defaultViews);
  this._renders = {};
  this._resetForRender();
}

function resetForRender(model, componentInstances) {
  componentInstances || (componentInstances = {});
  if (model) this.model = model;
  this._componentInstances = componentInstances;
  var libraries = this._libraries
    , i
  for (i = libraries.length; i--;) {
    libraries[i].view._resetForRender(model, componentInstances);
  }
}

function componentsByName(name) {
  return this._componentInstances[name] || [];
}

function componentConstructor(name) {
  return this._selfLibrary && this._selfLibrary.constructors[name];
}

function uniqueId() {
  return '$' + (this._idCount++).toString(36);
}

function make(name, template, options, templatePath) {
  var view = this
    , isString = options && options.literal
    , noMinify = isString
    , onBind, renderer, render, matchTitle;

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

  render = function(ctx, model, triggerId) {
    if (!renderer) {
      renderer = parse(view, name, template, isString, onBind, noMinify);
    }
    return renderer(ctx, model, triggerId);
  }

  render.nonvoid = options && options.nonvoid;

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

function find(name, ns, optional) {
  var view = this._findView(name, ns);
  if (view) return view;
  if (optional) return empty;
  if (ns) name = ns + ':' + name;
  throw new Error("Can't find template: \n  " + name + '\n\n' +
    'Available templates: \n  ' + Object.keys(this._views).join('\n  ')
  );
}

function get(name, ns, ctx) {
  if (typeof ns === 'object') {
    ctx = ns;
    ns = '';
  }
  ctx = ctx ? extend(ctx, defaultCtx) : Object.create(defaultCtx);
  var app = Object.create(this.app, {model: {value: this.model}});
  ctx.$fnCtx = [app];
  ctx.$pathIds = {};
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

function emitRender(view, ns, ctx, name) {
  if (view.isServer) return;
  view.app.emit(name, ctx);
  if (ns) view.app.emit(name + ':' + ns, ctx);
}
function beforeRender(model, ns, ctx) {
  ctx = (ctx && Object.create(ctx)) || {};
  ctx.$ns = ns;
  emitRender(this, ns, ctx, 'pre:render');
  return ctx;
}
function afterRender(ns, ctx) {
  emitRender(this, ns, ctx, 'render');
}
function beforeRoute() {
  this.app.dom.clear();
  // Remove all data, refs, listeners, and reactive functions
  // for the previous page
  var silentModel = this.model.silent();
  silentModel.destroy('_page');
  silentModel.destroy('$components');
  // Unfetch and unsubscribe from all queries and documents
  silentModel.unload();
  var lastRender = this._lastRender;
  if (!lastRender) return;
  emitRender(this, lastRender.ns, lastRender.ctx, 'replace');
}

function render(model, ns, ctx, renderHash) {
  if (typeof ns === 'object') {
    renderHash = ctx;
    ctx = ns;
    ns = '';
  }
  this.model = model;

  if (!ctx.$isServer) ctx = this._beforeRender(model, ns, ctx);
  this._lastRender = {
    ns: ns
  , ctx: ctx
  };

  this._resetForRender();
  model.__pathMap.clear();
  model.__events.clear();
  model.__blockPaths = {};
  this.app.dom.clear();
  model.silent().destroy('$components');

  var title = this.get('title$s', ns, ctx)
    , rootHtml = this.get('root', ns, ctx)
    , bodyHtml = this.get('header', ns, ctx) +
        this.get('body', ns, ctx) +
        this.get('footer', ns, ctx)
    , doc = window.document
    , err

  if (renderHash) {
    // Check hashes in development to help find rendering bugs
    if (renderHash === md5(bodyHtml)) {
      this._flushUncreated();
      return;
    }
    err = new Error('Server and client page renders do not match');
    setTimeout(function() {
      throw err;
    }, 0);
  } else if (ctx.$isServer) {
    // Don't finish rendering client side on the very first load, since
    // the page should already have the same HTML from the server
    this._flushUncreated();
    return;
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

  this.app.dom._setDirty(true);
  this._flushUncreated();
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

function modelListener(params, triggerId, blockPaths, pathId, partial, ctx, saveBlockPath) {
  var listener = typeof params === 'function'
    ? params(triggerId, blockPaths, saveBlockPath && pathId)
    : params;
  listener.partial = partial;
  listener.ctx = ctx.$stringCtx || ctx;
  return listener;
}

function bindPathEvent(events, bindName, getName, partial, params, saveBlockPath) {
  events.push(function(ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId) {
    var path = ctxPath(view, ctx, bindName)
    if (!path) return;
    var pathId = pathMap.id(path);
    var listener = modelListener(params, triggerId, blockPaths, pathId, partial, ctx, saveBlockPath);
    if (bindName !== getName) {
      listener.getValue = function(model) {
        return dataValue(view, ctx, model, getName);
      };
    }
    modelEvents.bind(pathId, listener);
  });
}
function bindEachPathEvent(events, name, getName, partial, params) {
  var bracketIndex = name.indexOf('[');
  if (~bracketIndex) {
    // Bind to each of the items inside brackets
    var paths = viewPath.squareBracketsArgs(name);
    for (var i = paths.length; i--;) {
      bindEachPathEvent(events, paths[i], getName, partial, params);
    }
    // Bind to anything under the root. This ins't very efficent, but it
    // should cover various cases that would require updating the bindings
    // when the arguments inside of the brackets change, which I don't feel
    // like figuring out at the moment
    var before = name.slice(0, bracketIndex);
    if (before) bindEachPathEvent(events, before + '*', getName, partial, params);
    return;
  }
  var match = /(\.*)(.*)/.exec(name);
  var prefix = match[1] || '';
  var relativeName = match[2] || '';
  var segments = relativeName.split('.');
  // This loop stops before reaching zero
  var saveBlockPath = true;
  for (var i = segments.length; i; i--) {
    var bindName = prefix + segments.slice(0, i).join('.');
    bindPathEvent(events, bindName, getName, partial, params, saveBlockPath);
    saveBlockPath = false;
  }
}
function bindEvents(events, name, partial, params) {
  if (~name.indexOf('(')) {
    var args = pathFnArgs(name);
    for (var i = args.length; i--;) {
      bindEachPathEvent(events, args[i] + '*', name, partial, params);
    }
    return;
  }
  bindEachPathEvent(events, name, name, partial, params);
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

function pushValue(html, i, value, isAttr) {
  if (typeof value === 'function') {
    i = html.push(value, '') - 1;
  } else {
    html[i] += isAttr ? escapeAttribute(value) : value;
  }
  return i;
}

function reduceStack(stack) {
  var html = ['']
    , i = 0
    , attrs, bool, item, key, value, j, len;

  for (j = 0, len = stack.length; j < len; j++) {
    item = stack[j];
    switch (item[0]) {
      case 'start':
        html[i] += '<' + item[1];
        attrs = item[2];
        // Make sure that the id attribute is rendered first
        if ('id' in attrs) {
          html[i] += ' id=';
          i = pushValue(html, i, attrs.id, true);
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
        i = pushValue(html, i, item[2].id);
        html[i] += '-->';
    }
  }
  return html;
}

function renderer(view, items, events, onRender) {
  return function(ctx, model, triggerId) {
    if (!model) model = view.model;  // Needed, since model parameter is optional

    if (onRender) ctx = onRender(ctx);

    var html = '';
    for (var i = 0, len = items.length; i < len; i++) {
      item = items[i];
      html += (typeof item === 'function') ? item(ctx, model) || '' : item;
    }
    if (view.isServer) return html;

    var pathMap = model.__pathMap;
    var modelEvents = model.__events;
    var blockPaths = model.__blockPaths;
    var dom = global.DERBY && global.DERBY.app.dom;
    // Note that the events array can grow during rendering
    var i = 0;
    var event;
    while (event = events[i++]) {
      event(ctx, modelEvents, dom, pathMap, view, blockPaths, triggerId);
    }
    return html;
  }
}

function bindComponentEvent(component, name, listener) {
  if (name === 'init' || name === 'create') {
    component.once(name, listener.fn);
  } else {
    // Extra indirection allows listener to overwrite itself after first run
    component.on(name, function() {
      listener.fn.apply(null, arguments);
    });
  }
}
function bindComponentEvents(ctx, component, events) {
  var view = events.$view
    , items = events.$events
    , listenerCtx = Object.create(ctx)
    , i, item, name, listener
  // The fnCtx will include this component, but we want to emit
  // on the parent component or app
  listenerCtx.$fnCtx = listenerCtx.$fnCtx.slice(0, -1);
  for (i = items.length; i--;) {
    item = items[i];
    name = item[0];
    listener = fnListener(view, listenerCtx, item[2]);
    bindComponentEvent(component, name, listener);
  }
}

function createComponent(view, model, Component, scope, ctx, macroCtx) {
  var scoped = model.scope(scope)
    , marker = '<!--' + scope + '-->'
    , prefix = scope + '.'
    , component = new Component(scoped, scope)
    , parentFnCtx = model.__fnCtx || ctx.$fnCtx
    , silentCtx = Object.create(ctx, {$silent: {value: true}})
    , silentModel = model.silent()
    , i, key, path, value, instanceName, instances

  ctx.$fnCtx = model.__fnCtx = parentFnCtx.concat(component);

  // HACK: Ensure that scoped model has something set
  scoped.set('$null', null);

  for (key in macroCtx) {
    value = macroCtx[key];
    if (key === 'bind') {
      bindComponentEvents(ctx, component, value);
      continue;
    }
    if (value && value.$matchName) {
      path = ctxPath(view, ctx, value.$matchName);
      if (value.$bound) {
        silentModel.ref(prefix + key, path, {updateIndices: true});
        continue;
      }
      value = dataValue(view, ctx, model, path);
      silentModel.set(prefix + key, value);
      continue;
    }
    // TODO: Figure out how to get value of templatized attributes
    if (typeof value === 'function') continue;
    silentModel.set(prefix + key, value);
  }

  instanceName = scoped.get('name');
  if (instanceName) {
    instances = view._componentInstances[instanceName] ||
      (view._componentInstances[instanceName] = []);
    instances.push(component);
  }

  if (component.init) component.init(scoped);
  component.emit('init', component);

  if (view.isServer || ctx.$silent) return marker;

  var app = global.DERBY && global.DERBY.app
    , dom = app.dom
  component.dom = dom;
  component.history = app.history;

  var uncreated = new UncreatedComponent(component, scoped, dom, scope, ctx);
  view._uncreated.push(uncreated);

  return marker;
}

function UncreatedComponent(component, model, dom, scope, ctx) {
  this.component = component;
  this.model = model;
  this.dom = dom;
  this.scope = scope;
  this.ctx = ctx;
}
UncreatedComponent.prototype.create = function() {
  // TODO: Figure out underlying issue and remove
  // If for some reason, component's scoped model does not have any data,
  // do nothing. Not sure why it would get to this state, but it does.
  if (!this.model.get()) return;

  // Destroy in case component was created and replaced within rendering
  if (!this.dom.marker(this.scope)) {
    this.component.emit('destroy');
    return;
  }

  this.dom.addComponent(this.ctx, this.component);
  if (this.component.create) this.component.create(this.model, this.component.dom);
  this.component.emit('create', this.component);
};

function flushUncreated() {
  var uncreated;
  while (uncreated = this._uncreated.shift()) {
    uncreated.create();
  }
};

function extendCtx(view, ctx, value, name, alias, isEach) {
  var path = ctxPath(view, ctx, name)
    , aliases;
  ctx = extend(ctx, value);
  ctx['this'] = value;
  if (alias) {
    aliases = ctx.$aliases = Object.create(ctx.$aliases);
    aliases[alias] = ctx.$paths.length;
    if (isEach) aliases[alias]++;
  }
  if (path) {
    ctx.$paths = [path].concat(ctx.$paths);
  }
  ctx.$pathIds = Object.create(ctx.$pathIds);
  return ctx;
}

function partialValue(view, ctx, model, name, value, listener) {
  if (listener) return value;
  return name ? dataValue(view, ctx, model, name) : true;
}

function partialFn(view, name, type, alias, render, ns, macroCtx) {
  function partialBlock (ctx, model, triggerId, value, index, listener) {
    // Inherit & render attribute context values
    var renderMacroCtx = {}
      , parentMacroCtx = ctx.$macroCtx
      , mergedMacroCtx = macroCtx
      , key, val, matchName
    if (macroCtx.inherit) {
      mergedMacroCtx = {};
      derby.util.mergeInto(mergedMacroCtx, parentMacroCtx);
      derby.util.mergeInto(mergedMacroCtx, macroCtx);
      delete mergedMacroCtx.inherit;
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
    var partialNs, partialName, partialOptional, arr;
    if (name === 'derby:view') {
      partialNs = mergedMacroCtx.ns || view._selfNs;
      partialName = mergedMacroCtx.view;
      partialOptional = mergedMacroCtx.optional;
      if (!partialName) throw new Error('<derby:view> tag without a "view" attribute')
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
    // This can happen when using <derby:view view={{...}}>
    if (typeof partialName === 'function') {
      partialName = partialName(Object.create(ctx), model);
    }
    var partialView = nsView(view, partialNs)
      , render = partialView._find(partialName, ns, partialOptional)
      , Component = partialView._componentConstructor(partialName)
      , renderCtx, scope, out, marker

    // Prepare the context for rendering
    if (Component) {
      scope = '$components.' + view._uniqueId();
      renderCtx = extendCtx(view, ctx, null, scope, 'self');
      renderCtx.$elements = {};
      marker = createComponent(view, model, Component, scope, renderCtx, renderMacroCtx);
    } else {
      renderCtx = Object.create(ctx);
    }
    renderCtx.$macroCtx = renderMacroCtx;

    out = render(renderCtx, model);
    if (Component) {
      if (model.__fnCtx) {
        model.__fnCtx = model.__fnCtx.slice(0, -1);
      }
      out = marker + out;
    }
    return out;
  }

  function withBlock(ctx, model, triggerId, value, index, listener) {
    value = partialValue(view, ctx, model, name, value, listener);
    var renderCtx = extendCtx(view, ctx, value, name, alias);
    return render(renderCtx, model);
  }

  function ifBlock(ctx, model, triggerId, value, index, listener) {
    value = partialValue(view, ctx, model, name, value, listener);
    if (!(Array.isArray(value) ? value.length : value)) return;
    var renderCtx = extendCtx(view, ctx, value, name, alias);
    return render(renderCtx, model);
  }

  function unlessBlock(ctx, model, triggerId, value, index, listener) {
    value = partialValue(view, ctx, model, name, value, listener);
    if (Array.isArray(value) ? value.length : value) return;
    var renderCtx = extendCtx(view, ctx, value, name, alias);
    return render(renderCtx, model);
  }

  function eachBlock(ctx, model, triggerId, value, index, listener) {
    value = partialValue(view, ctx, model, name, value, listener);
    var isArray = Array.isArray(value);

    if (listener && !isArray) {
      if (value === void 0) return;
      var listCtx = extendCtx(view, ctx, null, name, alias, true);
      var itemPath = listCtx.$paths[0] + '.' + index;
      var item = partialValue(view, listCtx, model, itemPath, value, listener);
      renderCtx = extend(listCtx, item);
      renderCtx['this'] = item;
      renderCtx.$indices = [index].concat(renderCtx.$indices);
      renderCtx.$index = index;
      renderCtx.$paths = [itemPath].concat(renderCtx.$paths);
      return render(renderCtx, model);
    }

    if (!isArray || !value.length) return;

    var listCtx = extendCtx(view, ctx, null, name, alias, true);

    var out = '';
    var indices = listCtx.$indices;
    var paths = listCtx.$paths;
    var basePath = paths[0];
    for (var i = 0, len = value.length; i < len; i++) {
      var item = value[i];
      var renderCtx = extend(listCtx, item);
      renderCtx['this'] = item;
      renderCtx.$indices = [i].concat(indices);
      renderCtx.$index = i;
      renderCtx.$paths = [basePath + '.' + i].concat(paths);
      out += (item === void 0) ?
        '<!--empty-->' :
        render(renderCtx, model);
    }
    return out;
  }

  var block =
      (type === 'partial') ? partialBlock
    : (type === 'with' || type === 'else') ? withBlock
    : (type === 'if' || type === 'else if') ? ifBlock
    : (type === 'unless') ? unlessBlock
    : (type === 'each') ? eachBlock
    : null

  if (!block) throw new Error('Unknown block type: ' + type);
  block.type = type;
  return block;
}

var objectToString = Object.prototype.toString;
var arrayToString = Array.prototype.toString;

function valueBinding(value) {
  return value == null ? '' :
    (value.toString === objectToString || value.toString === arrayToString) ?
    JSON.stringify(value) : value;
}

function valueText(value) {
  return valueBinding(value).toString();
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
  var render = renderer(view, reduceStack(queue.stack), queue.events);
  var block = queue.block;
  return partialFn(view, block.name, block.type, block.alias, render);
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
    out = function(ctx, model, triggerId, value, index, listener) {
      var out;
      for (i = 0; i < len; i++) {
        out = fns[i](ctx, model, triggerId, value, index, listener);
        if (out != null) return out;
      }
    }
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
  if (tagName === 'derby:view') return true;
  var split = splitPartial(tagName);
  if (!split) return false;
  var tagNs = split[0];
  return (
    tagNs === 'app' ||
    tagNs === 'lib' ||
    !!libraryForNs(view, tagNs)
  );
}

function isPartialSection(tagName) {
  return tagName.charAt(0) === '@';
}

function partialSectionName(tagName) {
  return isPartialSection(tagName) ? tagName.slice(1) : null;
}

function libraryForNs(view, ns) {
  var library = view._libraries.map[ns];
  if (library) return library;
  if (view.parent) return view.parent.view._libraries.map[ns];
}

function nsView(view, ns) {
  if (ns === view._selfNs) return view;
  if (view.parent && ns === view.parent.view._selfNs) return view.parent.view;
  var library = libraryForNs(view, ns);
  if (!library) throw new Error('No library found with namespace ' + ns);
  var partialView = library.view;
  partialView._uniqueId = function() {
    return view._uniqueId();
  };
  partialView.model = view.model;
  partialView._uncreated = view._uncreated;
  return partialView;
}

function splitPartial(partial) {
  var i = partial.indexOf(':');
  if (i === -1) return;
  var partialNs = partial.slice(0, i);
  var partialName = partial.slice(i + 1);
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
  if (partial === 'derby:view') return true;
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

  if (!value) {
    // A true boolean attribute will have a value of null
    if (value === null) attrs[attr] = true;
    return;
  }

  if (attr === 'bind') {
    attrs[attr] = {$events: splitEvents(value), $view: view};
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

function parse(view, viewName, template, isString, onBind, noMinify) {
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

  function parseStart(tag, tagName, attrs) {
    var attr, block, out, parser, isSection, attrBlock
    if ('x-no-minify' in attrs) {
      delete attrs['x-no-minify'];
      noMinify = true;
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
      if (!noMinify) {
        text = isString ? unescapeEntities(trimText(text)) : trimText(text);
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
    if (endsPartial && isVoidComponent(view, tagName, ns)) {
      throw new Error('End tag "' + tag + '" is not allowed for void component')
    }
    if (sectionName || endsPartial) {
      onBlock(false, true, null, queues, {
        onStart: onStart
      , onEnd: function(queues) {
          var queue = queues[0]
            , block = queue.block
            , fn = renderer(view, reduceStack(queue.stack), queue.events)
          fn.unescaped = true;
          if (sectionName) {
            block.macroCtx[sectionName] = fn;
            return;
          }
          // Put the remaining content not in a section in the default "content" section,
          // unless "inherit" is specified and there is no content, so that the parent
          // content can be inherited
          if (queue.stack.length || !block.macroCtx.inherit) {
            block.macroCtx.content = fn;
          }
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
