/*
 * components.js
 *
 * Components associate custom script functionality with a view. They can be
 * distributed as standalone modules containing templates, scripts, and styles.
 * They can also be used to modularize application functionality.
 *
 */

var util = require('racer/lib/util');
var derbyTemplates = require('./templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var Controller = require('./Controller');
var checkKeyIsSafe = require('./templates/util').checkKeyIsSafe;
var slice = [].slice;

exports.Component = Component;
exports.ComponentAttribute = ComponentAttribute;
exports.ComponentAttributeBinding = ComponentAttributeBinding;
exports.ComponentFactory = ComponentFactory;
exports.SingletonComponentFactory = SingletonComponentFactory;
exports.createFactory = createFactory;
exports.extendComponent = extendComponent;

function Component(context, data) {
  var parent = context.controller;
  var id = context.id();
  var scope = ['$components', id];
  var model = parent.model.root.eventContext(id);
  model._at = scope.join('.');
  data.id = id;
  model._set(scope, data);
  // Store a reference to the component's scope such that the expression
  // getters are relative to the component
  model.data = data;

  Controller.call(this, parent.app, parent.page, model);
  this.parent = parent;
  this.context = context.componentChild(this);
  this.id = id;
  this._scope = scope;

  // Add reference to this component on the page so that all components
  // associated with a page can be destroyed when the page transitions
  this.page._components[id] = this;
  this.isDestroyed = false;
}

util.mergeInto(Component.prototype, Controller.prototype);

Component.prototype.destroy = function() {
  this.emit('destroy');
  this.model.removeContextListeners();
  this.model.destroy();
  delete this.page._components[this.id];
  if (this.page._eventModel.object) {
    var components = this.page._eventModel.object.$components;
    if (components) delete components.object[this.id];
  }
  this.isDestroyed = true;
};

// Apply calls to the passed in function with the component as the context.
// Stop calling back once the component is destroyed, which avoids possible bugs
// and memory leaks.
Component.prototype.bind = function(callback) {
  var component = this;
  this.on('destroy', function() {
    // Reduce potential for memory leaks by removing references to the component
    // and the passed in callback, which could have closure references
    component = null;
    // Cease calling back after component is removed from the DOM
    callback = null;
  });
  return function componentBindWrapper() {
    if (!callback) return;
    return callback.apply(component, arguments);
  };
};

// When passing in a numeric delay, calls the function at most once per that
// many milliseconds. Like Underscore, the function will be called on the
// leading and the trailing edge of the delay as appropriate. Unlike Underscore,
// calls are consistently called via setTimeout and are never synchronous. This
// should be used for reducing the frequency of ongoing updates, such as scroll
// events or other continuous streams of events.
//
// Additionally, implements an interface intended to be used with
// window.requestAnimationFrame or process.nextTick. If one of these is passed,
// it will be used to create a single async call following any number of
// synchronous calls. This mode is typically used to coalesce many synchronous
// events (such as multiple model events) into a single async event.
//
// Like component.bind(), will no longer call back once the component is
// destroyed, which avoids possible bugs and memory leaks.
Component.prototype.throttle = function(callback, delayArg) {
  var component = this;
  this.on('destroy', function() {
    // Reduce potential for memory leaks by removing references to the component
    // and the passed in callback, which could have closure references
    component = null;
    // Cease calling back after component is removed from the DOM
    callback = null;
  });

  // throttle(callback)
  // throttle(callback, 150)
  if (delayArg == null || typeof delayArg === 'number') {
    var delay = delayArg || 0;
    var nextArgs;
    var previous;
    var boundCallback = function() {
      var args = nextArgs;
      nextArgs = null;
      previous = +new Date();
      if (callback && args) {
        callback.apply(component, args);
      }
    };
    return function componentThrottleWrapper() {
      var queueCall = !nextArgs;
      nextArgs = slice.call(arguments);
      if (queueCall) {
        var now = +new Date();
        var remaining = Math.max(previous + delay - now, 0);
        setTimeout(boundCallback, remaining);
      }
    };
  }

  // throttle(callback, window.requestAnimationFrame)
  // throttle(callback, process.nextTick)
  if (typeof delayArg === 'function') {
    var nextArgs;
    var boundCallback = function() {
      var args = nextArgs;
      nextArgs = null;
      if (callback && args) {
        callback.apply(component, args);
      }
    };
    return function componentThrottleWrapper() {
      var queueCall = !nextArgs;
      nextArgs = slice.call(arguments);
      if (queueCall) delayArg(boundCallback);
    };
  }

  throw new Error('Second argument must be a delay function or number');
};

function _safeWrap(component, callback) {
  return function() {
    if (component.isDestroyed) return;
    callback.call(component);
  };
}

// Checks that component is not destroyed before calling callback function
// which avoids possible bugs and memory leaks.
Component.prototype.requestAnimationFrame = function(callback) {
  var safeCallback = _safeWrap(this, callback);
  window.requestAnimationFrame(safeCallback);
};

// Checks that component is not destroyed before calling callback function
// which avoids possible bugs and memory leaks.
Component.prototype.nextTick = function(callback) {
  var safeCallback = _safeWrap(this, callback);
  process.nextTick(safeCallback);
};

// Suppresses calls until the function is no longer called for that many
// milliseconds. This should be used for delaying updates triggered by user
// input, such as window resizing, or typing text that has a live preview or
// client-side validation. This should not be used for inputs that trigger
// server requests, such as search autocomplete; use debounceAsync for those
// cases instead.
//
// Like component.bind(), will no longer call back once the component is
// destroyed, which avoids possible bugs and memory leaks.
Component.prototype.debounce = function(callback, delay) {
  delay = delay || 0;
  if (typeof delay !== 'number') {
    throw new Error('Second argument must be a number');
  }
  var component = this;
  this.on('destroy', function() {
    // Reduce potential for memory leaks by removing references to the component
    // and the passed in callback, which could have closure references
    component = null;
    // Cease calling back after component is removed from the DOM
    callback = null;
  });
  var nextArgs;
  var timeout;
  var boundCallback = function() {
    var args = nextArgs;
    nextArgs = null;
    timeout = null;
    if (callback && args) {
      callback.apply(component, args);
    }
  };
  return function componentDebounceWrapper() {
    nextArgs = slice.call(arguments);
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(boundCallback, delay);
  };
};

// Forked from: https://github.com/juliangruber/async-debounce
//
// Like debounce(), suppresses calls until the function is no longer called for
// that many milliseconds. In addition, suppresses calls while the callback
// function is running. In other words, the callback will not be called again
// until the supplied done() argument is called. When the debounced function is
// called while the callback is running, the callback will be called again
// immediately after done() is called. Thus, the callback will always receive
// the last value passed to the debounced function.
//
// This avoids the potential for multiple callbacks to execute in parallel and
// complete out of order. It also acts as an adaptive rate limiter. Use this
// method to debounce any field that triggers an async call as the user types.
//
// Like component.bind(), will no longer call back once the component is
// destroyed, which avoids possible bugs and memory leaks.
Component.prototype.debounceAsync = function(callback, delay) {
  var applyArguments = callback.length !== 1;
  delay = delay || 0;
  if (typeof delay !== 'number') {
    throw new Error('Second argument must be a number');
  }
  var component = this;
  this.on('destroy', function() {
    // Reduce potential for memory leaks by removing references to the component
    // and the passed in callback, which could have closure references
    component = null;
    // Cease calling back after component is removed from the DOM
    callback = null;
  });
  var running = false;
  var nextArgs;
  var timeout;
  function done() {
    var args = nextArgs;
    nextArgs = null;
    timeout = null;
    if (callback && args) {
      running = true;
      args.push(done);
      callback.apply(component, args);
    } else {
      running = false;
    }
  }
  return function componentDebounceAsyncWrapper() {
    nextArgs = (applyArguments) ? slice.call(arguments) : [];
    if (timeout) clearTimeout(timeout);
    if (running) return;
    timeout = setTimeout(done, delay);
  };
};

Component.prototype.get = function(viewName, unescaped) {
  var view = this.getView(viewName);
  return view.get(this.context, unescaped);
};

Component.prototype.getFragment = function(viewName) {
  var view = this.getView(viewName);
  return view.getFragment(this.context);
};

Component.prototype.getView = function(viewName) {
  var contextView = this.context.getView();
  return (viewName) ?
    this.app.views.find(viewName, contextView.namespace) : contextView;
};

Component.prototype.getAttribute = function(key) {
  var attributeContext = this.context.forAttribute(key);
  if (!attributeContext) return;
  var value = attributeContext.attributes[key];
  if (value instanceof expressions.Expression) {
    value = value.get(attributeContext);
  }
  return expressions.renderValue(value, this.context);
};

Component.prototype.setAttribute = function(key, value) {
  checkKeyIsSafe(key);
  this.context.parent.attributes[key] = value;
};

Component.prototype.setNullAttribute = function(key, value) {
  checkKeyIsSafe(key);
  var attributes = this.context.parent.attributes;
  if (attributes[key] == null) attributes[key] = value;
};

function ComponentAttribute(expression, model, key) {
  checkKeyIsSafe(key);
  this.expression = expression;
  this.model = model;
  this.key = key;
}
ComponentAttribute.prototype.update = function(context, binding) {
  var value = this.expression.get(context);
  binding.condition = value;
  this.model.setDiff(this.key, value);
};
function ComponentAttributeBinding(expression, model, key, context) {
  this.template = new ComponentAttribute(expression, model, key);
  this.context = context;
  this.condition = expression.get(context);
}
ComponentAttributeBinding.prototype = Object.create(templates.Binding.prototype);
ComponentAttributeBinding.prototype.constructor = ComponentAttributeBinding;

function setModelAttributes(context, model) {
  var attributes = context.parent.attributes;
  if (!attributes) return;
  // Set attribute values on component model
  for (var key in attributes) {
    var value = attributes[key];
    setModelAttribute(context, model, key, value);
  }
}

function setModelAttribute(context, model, key, value) {
  // If an attribute is an Expression, set its current value in the model
  // and keep it up to date. When it is a resolvable path, use a Racer ref,
  // which makes it a two-way binding. Otherwise, set to the current value
  // and create a binding that will set the value in the model as the
  // expression's dependencies change.
  if (value instanceof expressions.Expression) {
    var segments = value.pathSegments(context);
    if (segments) {
      model.root.ref(model._at + '.' + key, segments.join('.'), {updateIndices: true});
    } else {
      var binding = new ComponentAttributeBinding(value, model, key, context);
      context.addBinding(binding);
      model.set(key, binding.condition);
    }
    return;
  }

  // If an attribute is a Template, set a template object in the model.
  // Eagerly rendering a template can cause excessive rendering when the
  // developer wants to pass in a complex chunk of HTML, and if we were to
  // set a string in the model that represents the template value, we'd lose
  // the ability to use the value in the component's template, since HTML
  // would be escaped and we'd lose the ability to create proper bindings.
  //
  // This may be of surprise to developers, since it may not be intuitive
  // whether a passed in value will produce an expression or a template. To
  // get the rendered value consistently, the component's getAttribute(key)
  // method may be used to get the value that would be rendered.
  if (value instanceof templates.Template) {
    var template = new templates.ContextClosure(value, context);
    model.set(key, template);
    return;
  }

  // For all other value types, set the passed in value directly. Passed in
  // values will only be set initially, so model paths should be used if
  // bindings are desired.
  model.set(key, value);
}

function createFactory(constructor) {
  // DEPRECATED: constructor.prototype.singleton is deprecated. "singleton"
  // static property on the constructor is preferred
  return (constructor.singleton || constructor.prototype.singleton) ?
    new SingletonComponentFactory(constructor) :
    new ComponentFactory(constructor);
}

function emitInitHooks(context, component) {
  if (!context.initHooks) return;
  // Run initHooks for `on` listeners immediately before init
  for (var i = 0, len = context.initHooks.length; i < len; i++) {
    context.initHooks[i].emit(context, component);
  }
}

function ComponentModelData() {
  this.id = null;
  this.$controller = null;
}

function ComponentFactory(constructor) {
  this.constructor = constructor;
}
ComponentFactory.prototype.init = function(context) {
  var DataConstructor = this.constructor.DataConstructor || ComponentModelData;
  var data = new DataConstructor();
  var component = new this.constructor(context, data);
  // Detect whether the component constructor already called super by checking
  // for one of the properties it sets. If not, call the Component constructor
  if (!component.context) {
    Component.call(component, context, data);
  }

  setModelAttributes(component.context, component.model);

  // Do the user-specific initialization. The component constructor should be
  // an empty function and the actual initialization code should be done in the
  // component's init method. This means that we don't have to rely on users
  // properly calling the Component constructor method and avoids having to
  // play nice with how CoffeeScript extends class constructors
  emitInitHooks(context, component);
  component.emit('init', component);
  if (component.init) component.init(component.model);

  return component.context;
};
ComponentFactory.prototype.create = function(context) {
  var component = context.controller;
  component.emit('create', component);
  // Call the component's create function after its view is rendered
  if (component.create) {
    component.create(component.model, component.dom);
  }
};

function noop() {}

function SingletonComponentFactory(constructor) {
  this.constructor = constructor;
  this.component = null;
  // Disable component from being destroyed, since it is intended to
  // be used multiple times
  constructor.prototype.destroy = noop;
}
SingletonComponentFactory.prototype.isSingleton = true;
SingletonComponentFactory.prototype.init = function(context) {
  if (!this.component) this.component = new this.constructor();
  return context.componentChild(this.component);
};
// Don't call the init or create methods for singleton components
SingletonComponentFactory.prototype.create = noop;

function isBasePrototype(object) {
  return (object === Object.prototype) ||
    (object === Function.prototype) ||
    (object === null);
}
function getRootPrototype(object) {
  while (true) {
    var prototype = Object.getPrototypeOf(object);
    if (isBasePrototype(prototype)) return object;
    object = prototype;
  }
}
var _extendComponent = (Object.setPrototypeOf && Object.getPrototypeOf) ?
  // Modern version, which supports ES6 classes
  function(constructor) {
    // Find the end of the prototype chain
    var rootPrototype = getRootPrototype(constructor.prototype);

    // This guard is a workaroud to a bug that has occurred in Chakra when
    // app.component() is invoked twice on the same constructor. In that case,
    // the `instanceof Component` check in extendComponent incorrectly returns
    // false after the prototype has already been set to `Component.prototype`.
    // Then, this code proceeds to set the prototype of Component.prototype
    // to itself, which throws a "Cyclic __proto__ value" error.
    // https://github.com/Microsoft/ChakraCore/issues/5915
    if (rootPrototype === Component.prototype) return;

    // Establish inheritance with the pattern that Node's util.inherits() uses
    // if Object.setPrototypeOf() is available (all modern browsers & IE11).
    // This inhertance pattern is not equivalent to class extends, but it does
    // work to make instances of the constructor inherit the desired prototype
    // https://github.com/nodejs/node/issues/4179
    Object.setPrototypeOf(rootPrototype, Component.prototype);
  } :
  // Fallback for older browsers
  function(constructor) {
    // In this version, we iterate over all of the properties on the
    // constructor's prototype and merge them into a new prototype object.
    // This flattens the prototype chain, meaning that instanceof will not
    // work for classes from which the current component inherits
    var prototype = constructor.prototype;
    // Otherwise, modify constructor.prototype. This won't work with ES6
    // classes, since their prototype property is non-writeable. However, it
    // does work in older browsers that don't support Object.setPrototypeOf(),
    // and those browsers don't support ES6 classes either
    constructor.prototype = Object.create(Component.prototype);
    constructor.prototype.constructor = constructor;
    util.mergeInto(constructor.prototype, prototype);
  };
function extendComponent(constructor) {
  // Don't do anything if the constructor already extends Component
  if (constructor.prototype instanceof Component) return;
  // Otherwise, append Component.prototype to constructor's prototype chain
  _extendComponent(constructor);
}
