var saddle = require('saddle');
var serializeObject = require('serialize-object');
var DependencyOptions = require('./options').DependencyOptions;
var util = require('./util');
var concat = util.concat;
var hasKeys = util.hasKeys;
var traverseAndCreate = util.traverseAndCreate;

(function() {
  for (var key in saddle) {
    exports[key] = saddle[key];
  }
})();

exports.Marker = Marker;
exports.View = View;
exports.ViewInstance = ViewInstance;
exports.DynamicViewInstance = DynamicViewInstance;
exports.ViewParent = ViewParent;
exports.ContextClosure = ContextClosure;

exports.Views = Views;

exports.MarkupHook = MarkupHook;
exports.ElementOn = ElementOn;
exports.ComponentOn = ComponentOn;
exports.AsProperty = AsProperty;
exports.AsObject = AsObject;
exports.AsObjectComponent = AsObjectComponent;
exports.AsArray = AsArray;
exports.AsArrayComponent = AsArrayComponent;

exports.emptyTemplate = new saddle.Template([]);

// Add ::isUnbound to Template && Binding
saddle.Template.prototype.isUnbound = function(context) {
  return context.unbound;
};
saddle.Binding.prototype.isUnbound = function() {
  return this.template.expression.isUnbound(this.context);
};

// Add Template::resolve
saddle.Template.prototype.resolve = function() {};

// The Template::dependencies method is specific to how Derby bindings work,
// so extend all of the Saddle Template types here
saddle.Template.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  return concatArrayDependencies(null, this.content, context, options);
};
saddle.Doctype.prototype.dependencies = function() {};
saddle.Text.prototype.dependencies = function() {};
saddle.DynamicText.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  return getDependencies(this.expression, context, options);
};
saddle.Comment.prototype.dependencies = function() {};
saddle.DynamicComment.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  return getDependencies(this.expression, context, options);
};
saddle.Html.prototype.dependencies = function() {};
saddle.DynamicHtml.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  return getDependencies(this.expression, context, options);
};
saddle.Element.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var dependencies = concatMapDependencies(null, this.attributes, context, options);
  if (!this.content) return dependencies;
  return concatArrayDependencies(dependencies, this.content, context, options);
};
saddle.DynamicElement.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var dependencies = saddle.Element.prototype.dependencies(context, options);
  return concatDependencies(dependencies, this.tagName, context, options);
};
saddle.Block.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var dependencies = (this.expression.meta && this.expression.meta.blockType === 'on') ?
    getDependencies(this.expression, context, options) : null;
  var blockContext = context.child(this.expression);
  return concatArrayDependencies(dependencies, this.content, blockContext, options);
};
saddle.ConditionalBlock.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var condition = this.getCondition(context);
  if (condition == null) {
    return getDependencies(this.expressions[0], context, options);
  }
  var dependencies = concatSubArrayDependencies(null, this.expressions, context, options, condition);
  var expression = this.expressions[condition];
  var content = this.contents[condition];
  var blockContext = context.child(expression);
  return concatArrayDependencies(dependencies, content, blockContext, options);
};
saddle.EachBlock.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var dependencies = getDependencies(this.expression, context, options);
  var items = this.expression.get(context);
  if (items && items.length) {
    for (var i = 0; i < items.length; i++) {
      var itemContext = context.eachChild(this.expression, i);
      dependencies = concatArrayDependencies(dependencies, this.content, itemContext, options);
    }
  } else if (this.elseContent) {
    dependencies = concatArrayDependencies(dependencies, this.elseContent, context, options);
  }
  return dependencies;
};
saddle.Attribute.prototype.dependencies = function() {};
saddle.DynamicAttribute.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  return getDependencies(this.expression, context, options);
};

function concatSubArrayDependencies(dependencies, expressions, context, options, end) {
  for (var i = 0; i <= end; i++) {
    dependencies = concatDependencies(dependencies, expressions[i], context, options);
  }
  return dependencies;
}
function concatArrayDependencies(dependencies, expressions, context, options) {
  for (var i = 0; i < expressions.length; i++) {
    dependencies = concatDependencies(dependencies, expressions[i], context, options);
  }
  return dependencies;
}
function concatMapDependencies(dependencies, expressions, context, options) {
  for (var key in expressions) {
    dependencies = concatDependencies(dependencies, expressions[key], context, options);
  }
  return dependencies;
}
function concatDependencies(dependencies, expression, context, options) {
  var expressionDependencies = getDependencies(expression, context, options);
  return concat(dependencies, expressionDependencies);
}
function getDependencies(expression, context, options) {
  return expression.dependencies(context, options);
}

var markerHooks = [{
  emit: function(context, node) {
    node.$component = context.controller;
    context.controller.markerNode = node;
  }
}];
function Marker(data) {
  saddle.Comment.call(this, data, markerHooks);
}
Marker.prototype = Object.create(saddle.Comment.prototype);
Marker.prototype.constructor = Marker;
Marker.prototype.type = 'Marker';
Marker.prototype.serialize = function() {
  return serializeObject.instance(this, this.data);
};
Marker.prototype.get = function() {
  return '';
};

function ViewAttributesMap(source) {
  var items = source.split(/\s+/);
  for (var i = 0, len = items.length; i < len; i++) {
    this[items[i]] = true;
  }
}
function ViewArraysMap(source) {
  var items = source.split(/\s+/);
  for (var i = 0, len = items.length; i < len; i++) {
    var item = items[i].split('/');
    this[item[0]] = item[1] || item[0];
  }
}
function View(views, name, source, options) {
  this.views = views;
  this.name = name;
  this.source = source;
  this.options = options;

  var nameSegments = (this.name || '').split(':');
  var lastSegment = nameSegments.pop();
  this.namespace = nameSegments.join(':');
  this.registeredName = (lastSegment === 'index') ? this.namespace : this.name;

  this.attributesMap = options && options.attributes &&
    new ViewAttributesMap(options.attributes);
  this.arraysMap = options && options.arrays &&
    new ViewArraysMap(options.arrays);
  // The empty string is considered true for easier HTML attribute parsing
  this.unminified = options && (options.unminified || options.unminified === '');
  this.string = options && (options.string || options.string === '');
  this.literal = options && (options.literal || options.literal === '');
  this.template = null;
  this.componentFactory = null;
  this.fromSerialized = false;
}
View.prototype = Object.create(saddle.Template.prototype);
View.prototype.constructor = View;
View.prototype.type = 'View';
View.prototype.serialize = function() {
  return null;
};
View.prototype._isComponent = function(context) {
  if (!this.componentFactory) return false;
  if (context.attributes && context.attributes.extend) return false;
  return true;
};
View.prototype._initComponent = function(context) {
  return (this._isComponent(context)) ?
    this.componentFactory.init(context) : context;
};
View.prototype._queueCreate = function(context, viewContext) {
  if (this._isComponent(context)) {
    var componentFactory = this.componentFactory;
    context.queue(function queuedCreate() {
      componentFactory.create(viewContext);
    });

    if (!context.hooks) return;
    context.queue(function queuedComponentHooks() {
      // Kick off hooks if view instance specified `on` or `as` attributes
      for (var i = 0, len = context.hooks.length; i < len; i++) {
        context.hooks[i].emit(context, viewContext.controller);
      }
    });
  }
};
View.prototype.get = function(context, unescaped) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  return template.get(viewContext, unescaped);
};
View.prototype.getFragment = function(context, binding) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  var fragment = template.getFragment(viewContext, binding);
  this._queueCreate(context, viewContext);
  return fragment;
};
View.prototype.appendTo = function(parent, context) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  template.appendTo(parent, viewContext);
  this._queueCreate(context, viewContext);
};
View.prototype.attachTo = function(parent, node, context) {
  var viewContext = this._initComponent(context);
  var template = this.template || this.parse();
  var node = template.attachTo(parent, node, viewContext);
  this._queueCreate(context, viewContext);
  return node;
};
View.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var template = this.template || this.parse();
  // We can't figure out relative path dependencies within a component without
  // rendering it, because each component instance's scope is dynamically set
  // based on its unique `id` property. To represent this, set the context
  // controller to `null`.
  //
  // Under normal rendering conditions, contexts should always have reference
  // to a controller. Expression::get() methods use the reference to
  // `context.controller.model.data` to lookup values, and paths are resolved
  // based on `context.controller.model._scope`.
  //
  // To handle this, Expression methods guard against a null controller by not
  // returning any dependencies for model paths. In addition, they return
  // `undefined` from get, which affect dependencies computed for
  // ConditionalBlock and EachBlock, as their dependencies will differ based
  // on the value of model data.
  //
  // TODO: This likely under-estimates the true dependencies within a
  // template. However, to provide a more complete view of dependencies, we'd
  // need information we only have at render time, namely, the scope and data
  // within the component model. This may indicate that Derby should use a
  // more Functional Reactive Programming (FRP)-like approach of having
  // dependencies be returned from getFragment and attach methods along with
  // DOM nodes rather than computing dependencies separately from rendering.
  var viewContext = (this._isComponent(context)) ?
    context.componentChild(null) : context;
  return template.dependencies(viewContext, options);
};
View.prototype.parse = function() {
  this._parse();
  if (this.componentFactory) {
    var marker = new Marker(this.name);
    this.template.content.unshift(marker);
  }
  return this.template;
};
// View.prototype._parse is defined in parsing.js, so that it doesn't have to
// be included in the client if templates are all parsed server-side
View.prototype._parse = function() {
  throw new Error('View parsing not available');
};

function ViewInstance(name, attributes, hooks, initHooks) {
  this.name = name;
  this.attributes = attributes;
  this.hooks = hooks;
  this.initHooks = initHooks;
  this.view = null;
}
ViewInstance.prototype = Object.create(saddle.Template.prototype);
ViewInstance.prototype.constructor = ViewInstance;
ViewInstance.prototype.type = 'ViewInstance';
ViewInstance.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.attributes, this.hooks, this.initHooks);
};
ViewInstance.prototype.get = function(context, unescaped) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.get(viewContext, unescaped);
};
ViewInstance.prototype.getFragment = function(context, binding) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.getFragment(viewContext, binding);
};
ViewInstance.prototype.appendTo = function(parent, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  view.appendTo(parent, viewContext);
};
ViewInstance.prototype.attachTo = function(parent, node, context) {
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.attachTo(parent, node, viewContext);
};
ViewInstance.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var view = this._find(context);
  var viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
  return view.dependencies(viewContext, options);
};
ViewInstance.prototype._find = function(context) {
  if (this.view) return this.view;
  var contextView = context.getView();
  var namespace = contextView && contextView.namespace;
  this.view = context.meta.views.find(this.name, namespace);
  if (!this.view) {
    var message = context.meta.views.findErrorMessage(this.name, contextView);
    throw new Error(message);
  }
  return this.view;
};

function DynamicViewInstance(nameExpression, attributes, hooks, initHooks) {
  this.nameExpression = nameExpression;
  this.attributes = attributes;
  this.hooks = hooks;
  this.initHooks = initHooks;
}
DynamicViewInstance.prototype = Object.create(ViewInstance.prototype);
DynamicViewInstance.prototype.constructor = DynamicViewInstance;
DynamicViewInstance.prototype.type = 'DynamicViewInstance';
DynamicViewInstance.prototype.serialize = function() {
  return serializeObject.instance(this, this.nameExpression, this.attributes, this.hooks, this.initHooks);
};
DynamicViewInstance.prototype._find = function(context) {
  var name = this.nameExpression.get(context);
  var contextView = context.getView();
  var namespace = contextView && contextView.namespace;
  var view = name && context.meta.views.find(name, namespace);
  return view || exports.emptyTemplate;
};
DynamicViewInstance.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var nameDependencies = this.nameExpression.dependencies(context);
  var viewDependencies = ViewInstance.prototype.dependencies.call(this, context, options);
  return concat(nameDependencies, viewDependencies);
};

// Without a ContextClosure, ViewParent will return the nearest context that
// is the parent of a view instance. When a context with a `closure` property
// is encountered first, ViewParent will find the specific referenced context,
// even if it is further up the context hierarchy.
function ViewParent(template) {
  this.template = template;
}
ViewParent.prototype = Object.create(saddle.Template.prototype);
ViewParent.prototype.constructor = ViewParent;
ViewParent.prototype.type = 'ViewParent';
ViewParent.prototype.serialize = function() {
  return serializeObject.instance(this, this.template);
};
ViewParent.prototype.get = function(context, unescaped) {
  var parentContext = context.forViewParent();
  return this.template.get(parentContext, unescaped);
};
ViewParent.prototype.getFragment = function(context, binding) {
  var parentContext = context.forViewParent();
  return this.template.getFragment(parentContext, binding);
};
ViewParent.prototype.appendTo = function(parent, context) {
  var parentContext = context.forViewParent();
  this.template.appendTo(parent, parentContext);
};
ViewParent.prototype.attachTo = function(parent, node, context) {
  var parentContext = context.forViewParent();
  return this.template.attachTo(parent, node, parentContext);
};
ViewParent.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
  var parentContext = context.forViewParent();
  return this.template.dependencies(parentContext, options);
};

// At render time, this template creates a context child and sets its
// `closure` property to a fixed reference. It is used in combination with
// ViewParent in order to control which context is returned.
//
// Instances of this template cannot be serialized. It is intended for use
// dynamically during rendering only.
function ContextClosure(template, context) {
  this.template = template;
  this.context = context;
}
ContextClosure.prototype = Object.create(saddle.Template.prototype);
ContextClosure.prototype.constructor = ContextClosure;
ContextClosure.prototype.serialize = function() {
  throw new Error('ContextClosure cannot be serialized');
};
ContextClosure.prototype.get = function(context, unescaped) {
  var closureContext = context.closureChild(this.context);
  return this.template.get(closureContext, unescaped);
};
ContextClosure.prototype.getFragment = function(context, binding) {
  var closureContext = context.closureChild(this.context);
  return this.template.getFragment(closureContext, binding);
};
ContextClosure.prototype.appendTo = function(parent, context) {
  var closureContext = context.closureChild(this.context);
  this.template.appendTo(parent, closureContext);
};
ContextClosure.prototype.attachTo = function(parent, node, context) {
  var closureContext = context.closureChild(this.context);
  return this.template.attachTo(parent, node, closureContext);
};
ContextClosure.prototype.dependencies = function(context, options) {
  if (DependencyOptions.shouldIgnoreTemplate(this.template, options)) return;
  var closureContext = context.closureChild(this.context);
  return this.template.dependencies(closureContext, options);
};
ContextClosure.prototype.equals = function(other) {
  return (other instanceof ContextClosure) &&
    (this.context === other.context) &&
    (this.template.equals(other.template));
};

function ViewsMap() {}
function Views() {
  this.nameMap = new ViewsMap();
  this.tagMap = new ViewsMap();
  // TODO: elementMap is deprecated and should be removed with Derby 0.6.0
  this.elementMap = this.tagMap;
}
Views.prototype.find = function(name, namespace) {
  var map = this.nameMap;

  // Exact match lookup
  var exactName = (namespace) ? namespace + ':' + name : name;
  var match = map[exactName];
  if (match) return match;

  // Relative lookup
  var segments = name.split(':');
  var segmentsDepth = segments.length;
  if (namespace) segments = namespace.split(':').concat(segments);
  // Iterate through segments, leaving the `segmentsDepth` segments and
  // removing the second to `segmentsDepth` segment to traverse up the
  // namespaces. Decrease `segmentsDepth` if not found and repeat again.
  while (segmentsDepth > 0) {
    var testSegments = segments.slice();
    while (testSegments.length > segmentsDepth) {
      testSegments.splice(-1 - segmentsDepth, 1);
      var testName = testSegments.join(':');
      var match = map[testName];
      if (match) return match;
    }
    segmentsDepth--;
  }
};
Views.prototype.register = function(name, source, options) {
  var mapName = name.replace(/:index$/, '');
  var view = this.nameMap[mapName];
  if (view) {
    // Recreate the view if it already exists. We re-apply the constructor
    // instead of creating a new view object so that references to object
    // can be cached after finding the first time
    var componentFactory = view.componentFactory;
    View.call(view, this, name, source, options);
    view.componentFactory = componentFactory;
  } else {
    view = new View(this, name, source, options);
  }
  this.nameMap[mapName] = view;
  // TODO: element is deprecated and should be removed with Derby 0.6.0
  var tagName = options && (options.tag || options.element);
  if (tagName) this.tagMap[tagName] = view;
  return view;
};
Views.prototype.deserialize = function(items) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var setTemplate = item[0];
    var name = item[1];
    var source = item[2];
    var options = item[3];
    var view = this.register(name, source, options);
    view.parse = setTemplate;
    view.fromSerialized = true;
  }
};
Views.prototype.serialize = function(options) {
  var forServer = options && options.server;
  var minify = options && options.minify;
  var items = [];
  for (var name in this.nameMap) {
    var view = this.nameMap[name];
    var template = view.template || view.parse();
    if (!forServer && view.options) {
      // Do not serialize views with the `serverOnly` option, except when
      // serializing for a server script
      if (view.options.serverOnly) continue;
      // For views with the `server` option, serialize them with a blank
      // template body. This allows them to be used from other views on the
      // browser, but they will output nothing on the browser
      if (view.options.server) template = exports.emptyTemplate;
    }
    // Serializing views as a function allows them to be constructed lazily upon
    // first use. This can improve initial load times of the application when
    // there are many views
    items.push(
      '[function(){return this.template=' +
        template.serialize() + '},' +
        serializeObject.args([
          view.name,
          (minify) ? null : view.source,
          (hasKeys(view.options)) ? view.options : null
        ]) +
      ']'
    );
  }
  return 'function(derbyTemplates, views){' +
    'var expressions = derbyTemplates.expressions,' +
    'templates = derbyTemplates.templates;' +
    'views.deserialize([' + items.join(',') + '])}';
};
Views.prototype.findErrorMessage = function(name, contextView) {
  var names = Object.keys(this.nameMap);
  var message = 'Cannot find view "' + name + '" in' +
    [''].concat(names).join('\n  ') + '\n';
  if (contextView) {
    message += '\nWithin template "' + contextView.name + '":\n' + contextView.source;
  }
  return message;
};


function MarkupHook() {}
MarkupHook.prototype.module = saddle.Template.prototype.module;

function ElementOn(name, expression) {
  this.name = name;
  this.expression = expression;
}
ElementOn.prototype = Object.create(MarkupHook.prototype);
ElementOn.prototype.constructor = ElementOn;
ElementOn.prototype.type = 'ElementOn';
ElementOn.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.expression);
};
ElementOn.prototype.emit = function(context, element) {
  var elementOn = this;
  if (this.name === 'create') {
    this.apply(context, element);

  } else if (this.name === 'destroy') {
    var destroyListeners = element.$destroyListeners || (element.$destroyListeners = []);
    destroyListeners.push(function elementOnDestroy() {
      elementOn.apply(context, element);
    });

  } else {
    element.addEventListener(this.name, function elementOnListener(event) {
      return elementOn.apply(context, element, event);
    }, false);
  }
};
ElementOn.prototype.apply = function(context, element, event) {
  var modelData = context.controller.model.data;
  modelData.$event = event;
  modelData.$element = element;
  var out = this.expression.apply(context);
  delete modelData.$event;
  delete modelData.$element;
  return out;
};

function ComponentOn(name, expression) {
  this.name = name;
  this.expression = expression;
}
ComponentOn.prototype = Object.create(MarkupHook.prototype);
ComponentOn.prototype.constructor = ComponentOn;
ComponentOn.prototype.type = 'ComponentOn';
ComponentOn.prototype.serialize = function() {
  return serializeObject.instance(this, this.name, this.expression);
};
ComponentOn.prototype.emit = function(context, component) {
  var expression = this.expression;
  component.on(this.name, function componentOnListener() {
    var args = arguments.length && Array.prototype.slice.call(arguments);
    return expression.apply(context, args);
  });
};

function AsProperty(segments) {
  this.segments = segments;
  this.lastSegment = segments.pop();
}
AsProperty.prototype = Object.create(MarkupHook.prototype);
AsProperty.prototype.constructor = AsProperty;
AsProperty.prototype.type = 'AsProperty';
AsProperty.prototype.serialize = function() {
  var segments = this.segments.concat(this.lastSegment);
  return serializeObject.instance(this, segments);
};
AsProperty.prototype.emit = function(context, target) {
  var node = traverseAndCreate(context.controller, this.segments);
  node[this.lastSegment] = target;
};

function AsObject(segments, keyExpression) {
  AsProperty.call(this, segments);
  this.keyExpression = keyExpression;
}
AsObject.prototype = Object.create(AsProperty.prototype);
AsObject.prototype.constructor = AsObject;
AsObject.prototype.type = 'AsObject';
AsObject.prototype.serialize = function() {
  var segments = this.segments.concat(this.lastSegment);
  return serializeObject.instance(this, segments, this.keyExpression);
};
AsObject.prototype.emit = function(context, target) {
  var node = traverseAndCreate(context.controller, this.segments);
  var object = node[this.lastSegment] || (node[this.lastSegment] = {});
  var key = this.keyExpression.get(context);
  object[key] = target;
  this.addListeners(target, object, key);
};
AsObject.prototype.addListeners = function(target, object, key) {
  this.addDestroyListener(target, function asObjectDestroy() {
    delete object[key];
  });
};
AsObject.prototype.addDestroyListener = function(target, listener) {
  var listeners = target.$destroyListeners || (target.$destroyListeners = []);
  listeners.push(listener);
};

function AsObjectComponent(segments, keyExpression) {
  AsObject.call(this, segments, keyExpression);
}
AsObjectComponent.prototype = Object.create(AsObject.prototype);
AsObjectComponent.prototype.constructor = AsObjectComponent;
AsObjectComponent.prototype.type = 'AsObjectComponent';
AsObjectComponent.prototype.addDestroyListener = function(target, listener) {
  target.on('destroy', listener);
};

function AsArray(segments) {
  AsProperty.call(this, segments);
}
AsArray.prototype = Object.create(AsProperty.prototype);
AsArray.prototype.constructor = AsArray;
AsArray.prototype.type = 'AsArray';
AsArray.prototype.emit = function(context, target) {
  var node = traverseAndCreate(context.controller, this.segments);
  var array = node[this.lastSegment] || (node[this.lastSegment] = []);

  // Iterate backwards, since rendering will usually append
  for (var i = array.length; i--;) {
    var item = array[i];
    // Don't add an item if already in the array
    if (item === target) return;
    var mask = this.comparePosition(target, item);
    // If the emitted target is after the current item in the document,
    // insert it next in the array
    // Node.DOCUMENT_POSITION_FOLLOWING = 4
    if (mask & 4) {
      array.splice(i + 1, 0, target);
      this.addListeners(target, array);
      return;
    }
  }
  // Add to the beginning if before all items
  array.unshift(target);
  this.addListeners(target, array);
};
AsArray.prototype.addListeners = function(target, array) {
  this.addDestroyListener(target, function asArrayDestroy() {
    var index = array.indexOf(target);
    if (index !== -1) array.splice(index, 1);
  });
};
AsArray.prototype.comparePosition = function(target, item) {
  return item.compareDocumentPosition(target);
};
AsArray.prototype.addDestroyListener = AsObject.prototype.addDestroyListener;

function AsArrayComponent(segments) {
  AsArray.call(this, segments);
}
AsArrayComponent.prototype = Object.create(AsArray.prototype);
AsArrayComponent.prototype.constructor = AsArrayComponent;
AsArrayComponent.prototype.type = 'AsArrayComponent';
AsArrayComponent.prototype.comparePosition = function(target, item) {
  return item.markerNode.compareDocumentPosition(target.markerNode);
};
AsArrayComponent.prototype.addDestroyListener = AsObjectComponent.prototype.addDestroyListener;
