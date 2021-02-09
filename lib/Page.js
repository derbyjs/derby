var derbyTemplates = require('derby-templates');
var contexts = derbyTemplates.contexts;
var expressions = derbyTemplates.expressions;
var templates = derbyTemplates.templates;
var DependencyOptions = derbyTemplates.options.DependencyOptions;
var util = require('racer/lib/util');
var components = require('./components');
var EventModel = require('./eventmodel');
var textDiff = require('./textDiff');
var Controller = require('./Controller');
var documentListeners = require('./documentListeners');

module.exports = Page;

function Page(app, model) {
  Controller.call(this, app, this, model);
  this.params = null;
  if (this.init) this.init(model);
  this.context = this._createContext();
  this._eventModel = null;
  this._removeModelListeners = null;
  this._components = {};
  this._addListeners();
}

util.mergeInto(Page.prototype, Controller.prototype);

Page.prototype.$bodyClass = function(ns) {
  if (!ns) return;
  var classNames = [];
  var segments = ns.split(':');
  for (var i = 0, len = segments.length; i < len; i++) {
    var className = segments.slice(0, i + 1).join('-');
    classNames.push(className);
  }
  return classNames.join(' ');
};

Page.prototype.$preventDefault = function(e) {
  e.preventDefault();
};

Page.prototype.$stopPropagation = function(e) {
  e.stopPropagation();
};

Page.prototype._setRenderParams = function(ns) {
  this.model.set('$render.ns', ns);
  this.model.set('$render.params', this.params);
  this.model.set('$render.url', this.params && this.params.url);
  this.model.set('$render.query', this.params && this.params.query);
};

Page.prototype._setRenderPrefix = function(ns) {
  var prefix = (ns) ? ns + ':' : '';
  this.model.set('$render.prefix', prefix);
};

Page.prototype.get = function(viewName, ns, unescaped) {
  this._setRenderPrefix(ns);
  var view = this.getView(viewName, ns);
  return view.get(this.context, unescaped);
};

Page.prototype.getFragment = function(viewName, ns) {
  this._setRenderPrefix(ns);
  var view = this.getView(viewName, ns);
  return view.getFragment(this.context);
};

Page.prototype.getView = function(viewName, ns) {
  return this.app.views.find(viewName, ns);
};

Page.prototype.render = function(ns) {
  this.app.emit('render', this);
  this.context.pause();
  this._setRenderParams(ns);
  var titleFragment = this.getFragment('TitleElement', ns);
  var bodyFragment = this.getFragment('BodyElement', ns);
  var titleElement = document.getElementsByTagName('title')[0];
  titleElement.parentNode.replaceChild(titleFragment, titleElement);
  document.body.parentNode.replaceChild(bodyFragment, document.body);
  this.context.unpause();
  if (this.create) this.create(this.model, this.dom);
  this.app.emit('routeDone', this, 'render');
};

Page.prototype.attach = function() {
  this.context.pause();
  var ns = this.model.get('$render.ns');
  var titleView = this.getView('TitleElement', ns);
  var bodyView = this.getView('BodyElement', ns);
  var titleElement = document.getElementsByTagName('title')[0];
  titleView.attachTo(titleElement.parentNode, titleElement, this.context);
  bodyView.attachTo(document.body.parentNode, document.body, this.context);
  this.context.unpause();
  if (this.create) this.create(this.model, this.dom);
};

Page.prototype._createContext = function() {
  var contextMeta = new contexts.ContextMeta();
  contextMeta.views = this.app && this.app.views;
  var context = new contexts.Context(contextMeta, this);
  context.expression = new expressions.PathExpression([]);
  context.alias = '#root';
  return context;
};

Page.prototype._addListeners = function() {
  var eventModel = this._eventModel = new EventModel();
  this._addModelListeners(eventModel);
  this._addContextListeners(eventModel);
};

Page.prototype.destroy = function() {
  this.emit('destroy');
  this._removeModelListeners();
  for (var id in this._components) {
    var component = this._components[id];
    component.destroy();
  }
  // Remove all data, refs, listeners, and reactive functions
  // for the previous page
  var silentModel = this.model.silent();
  silentModel.destroy('_page');
  silentModel.destroy('$components');
  // Unfetch and unsubscribe from all queries and documents
  silentModel.unloadAll && silentModel.unloadAll();
};

Page.prototype._addModelListeners = function(eventModel) {
  var model = this.model;
  if (!model) return;
  // Registering model listeners with the *Immediate events helps to prevent
  // a bug with binding updates where a model listener causes a change to the
  // path being listened on, directly or indirectly.

  // TODO: Remove this when upgrading Racer to the next major version. Feature
  // detect which type of event listener to register by emitting a test event
  if (useLegacyListeners(model)) {
    return this._addModelListenersLegacy(eventModel);
  }

  // `util.castSegments(segments)` is needed to cast string segments into
  // numbers, since EventModel#child does typeof checks against segments. This
  // could be done once in Racer's Model#emit, instead of in every listener.
  var changeListener = model.on('changeImmediate', function onChange(segments, event) {
    // The pass parameter is passed in for special handling of updates
    // resulting from stringInsert or stringRemove
    segments = util.castSegments(segments.slice());
    eventModel.set(segments, event.previous, event.passed);
  });
  var loadListener = model.on('loadImmediate', function onLoad(segments) {
    segments = util.castSegments(segments.slice());
    eventModel.set(segments);
  });
  var unloadListener = model.on('unloadImmediate', function onUnload(segments, event) {
    segments = util.castSegments(segments.slice());
    eventModel.set(segments, event.previous);
  });
  var insertListener = model.on('insertImmediate', function onInsert(segments, event) {
    segments = util.castSegments(segments.slice());
    eventModel.insert(segments, event.index, event.values.length);
  });
  var removeListener = model.on('removeImmediate', function onRemove(segments, event) {
    segments = util.castSegments(segments.slice());
    eventModel.remove(segments, event.index, event.values.length);
  });
  var moveListener = model.on('moveImmediate', function onMove(segments, event) {
    segments = util.castSegments(segments.slice());
    eventModel.move(segments, event.from, event.to, event.howMany);
  });

  this._removeModelListeners = function() {
    model.removeListener('changeImmediate', changeListener);
    model.removeListener('loadImmediate', loadListener);
    model.removeListener('unloadImmediate', unloadListener);
    model.removeListener('insertImmediate', insertListener);
    model.removeListener('removeImmediate', removeListener);
    model.removeListener('moveImmediate', moveListener);
  };
};
function useLegacyListeners(model) {
  var useLegacy = true;
  // model.once is broken in older racer, so manually remove event
  var listener = model.on('changeImmediate', function(segments, event) {
    model.removeListener('changeImmediate', listener);
    // Older Racer emits an array of eventArgs, whereas newer racer emits an event object
    useLegacy = Array.isArray(event);
  });
  model.set('$derby.testEvent', true);
  return useLegacy;
}
Page.prototype._addModelListenersLegacy = function(eventModel) {
  var model = this.model;
  if (!model) return;

  // `util.castSegments(segments)` is needed to cast string segments into
  // numbers, since EventModel#child does typeof checks against segments. This
  // could be done once in Racer's Model#emit, instead of in every listener.
  var changeListener = model.on('changeImmediate', function onChange(segments, eventArgs) {
    // eventArgs[0] is the new value, which Derby bindings don't use directly.
    var previous = eventArgs[1];
    // The pass parameter is passed in for special handling of updates
    // resulting from stringInsert or stringRemove
    var pass = eventArgs[2];
    segments = util.castSegments(segments.slice());
    eventModel.set(segments, previous, pass);
  });
  var loadListener = model.on('loadImmediate', function onLoad(segments) {
    segments = util.castSegments(segments.slice());
    eventModel.set(segments);
  });
  var unloadListener = model.on('unloadImmediate', function onUnload(segments) {
    segments = util.castSegments(segments.slice());
    eventModel.set(segments);
  });
  var insertListener = model.on('insertImmediate', function onInsert(segments, eventArgs) {
    var index = eventArgs[0];
    var values = eventArgs[1];
    segments = util.castSegments(segments.slice());
    eventModel.insert(segments, index, values.length);
  });
  var removeListener = model.on('removeImmediate', function onRemove(segments, eventArgs) {
    var index = eventArgs[0];
    var values = eventArgs[1];
    segments = util.castSegments(segments.slice());
    eventModel.remove(segments, index, values.length);
  });
  var moveListener = model.on('moveImmediate', function onMove(segments, eventArgs) {
    var from = eventArgs[0];
    var to = eventArgs[1];
    var howMany = eventArgs[2];
    segments = util.castSegments(segments.slice());
    eventModel.move(segments, from, to, howMany);
  });

  this._removeModelListeners = function() {
    model.removeListener('changeImmediate', changeListener);
    model.removeListener('loadImmediate', loadListener);
    model.removeListener('unloadImmediate', unloadListener);
    model.removeListener('insertImmediate', insertListener);
    model.removeListener('removeImmediate', removeListener);
    model.removeListener('moveImmediate', moveListener);
  };
};

Page.prototype._addContextListeners = function(eventModel) {
  this.context.meta.addBinding = addBinding;
  this.context.meta.removeBinding = removeBinding;
  this.context.meta.removeNode = removeNode;
  this.context.meta.addItemContext = addItemContext;
  this.context.meta.removeItemContext = removeItemContext;

  function addItemContext(context) {
    var segments = context.expression.resolve(context);
    eventModel.addItemContext(segments, context);
  }
  function removeItemContext(context) {
    // TODO
  }
  function addBinding(binding) {
    patchTextBinding(binding);
    var expressions = binding.template.expressions;
    if (expressions) {
      for (var i = 0, len = expressions.length; i < len; i++) {
        addDependencies(eventModel, expressions[i], binding);
      }
    } else {
      var expression = binding.template.expression;
      addDependencies(eventModel, expression, binding);
    }
  }
  function removeBinding(binding) {
    var bindingWrappers = binding.meta;
    if (!bindingWrappers) return;
    for (var i = bindingWrappers.length; i--;) {
      eventModel.removeBinding(bindingWrappers[i]);
    }
  }
  function removeNode(node) {
    var component = node.$component;
    if (component) component.destroy();
    var destroyListeners = node.$destroyListeners;
    if (destroyListeners) {
      for (var i = 0; i < destroyListeners.length; i++) {
        destroyListeners[i]();
      }
    }
  }
};

function addDependencies(eventModel, expression, binding) {
  var bindingWrapper = new BindingWrapper(eventModel, expression, binding);
  bindingWrapper.updateDependencies();
}

// The code here uses object-based set pattern where objects are keyed using
// sequentially generated IDs.
var nextId = 1;
function BindingWrapper(eventModel, expression, binding) {
  this.eventModel = eventModel;
  this.expression = expression;
  this.binding = binding;
  this.id = nextId++;
  this.eventModels = null;
  this.dependencies = null;
  this.ignoreTemplateDependency = (
    binding instanceof components.ComponentAttributeBinding
  ) || (
    (binding.template instanceof templates.DynamicText) &&
    (binding instanceof templates.RangeBinding)
  );
  if (binding.meta) {
    binding.meta.push(this);
  } else {
    binding.meta = [this];
  }
}
BindingWrapper.prototype.updateDependencies = function() {
  var dependencyOptions;
  if (this.ignoreTemplateDependency && this.binding.condition instanceof templates.Template) {
    dependencyOptions = new DependencyOptions();
    dependencyOptions.setIgnoreTemplate(this.binding.condition);
  }
  var dependencies = this.expression.dependencies(this.binding.context, dependencyOptions);
  if (this.dependencies) {
    // Do nothing if dependencies haven't changed
    if (equalDependencies(this.dependencies, dependencies)) return;
    // Otherwise, remove current dependencies
    this.eventModel.removeBinding(this);
  }
  // Add new dependencies
  if (!dependencies) return;
  this.dependencies = dependencies;
  for (var i = 0, len = dependencies.length; i < len; i++) {
    var dependency = dependencies[i];
    if (dependency) this.eventModel.addBinding(dependency, this);
  }
};
BindingWrapper.prototype.update = function(previous, pass) {
  this.binding.update(previous, pass);
  this.updateDependencies();
};
BindingWrapper.prototype.insert = function(index, howMany) {
  this.binding.insert(index, howMany);
  this.updateDependencies();
};
BindingWrapper.prototype.remove = function(index, howMany) {
  this.binding.remove(index, howMany);
  this.updateDependencies();
};
BindingWrapper.prototype.move = function(from, to, howMany) {
  this.binding.move(from, to, howMany);
  this.updateDependencies();
};

function equalDependencies(a, b) {
  var lenA = a ? a.length : -1;
  var lenB = b ? b.length : -1;
  if (lenA !== lenB) return false;
  for (var i = 0; i < lenA; i++) {
    var itemA = a[i];
    var itemB = b[i];
    var lenItemA = itemA ? itemA.length : -1;
    var lenItemB = itemB ? itemB.length : -1;
    if (lenItemA !== lenItemB) return false;
    for (var j = 0; j < lenItemB; j++) {
      if (itemA[j] !== itemB[j]) return false;
    }
  }
  return true;
}

function patchTextBinding(binding) {
  if (
    binding instanceof templates.AttributeBinding &&
    binding.name === 'value' &&
    (binding.element.tagName === 'INPUT' || binding.element.tagName === 'TEXTAREA') &&
    documentListeners.inputSupportsSelection(binding.element) &&
    binding.template.expression.resolve(binding.context)
  ) {
    binding.update = textInputUpdate;
  }
}

function textInputUpdate(previous, pass) {
  textUpdate(this, this.element, previous, pass);
}
function textUpdate(binding, element, previous, pass) {
  if (pass) {
    if (pass.$event && pass.$event.target === element) {
      return;
    } else if (pass.$stringInsert) {
      return textDiff.onStringInsert(
        element,
        previous,
        pass.$stringInsert.index,
        pass.$stringInsert.text
      );
    } else if (pass.$stringRemove) {
      return textDiff.onStringRemove(
        element,
        previous,
        pass.$stringRemove.index,
        pass.$stringRemove.howMany
      );
    }
  }
  binding.template.update(binding.context, binding);
}
