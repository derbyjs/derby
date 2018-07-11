/*
 * components.js
 *
 * Components associate custom script functionality with a view. They can be
 * distributed as standalone modules containing templates, scripts, and styles.
 * They can also be used to modularize application functionality.
 *
 */

var util = require('racer/lib/util');
var derbyTemplates = require('derby-templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var Controller = require('./Controller');

exports.Component = Component;
exports.ComponentAttribute = ComponentAttribute;
exports.ComponentAttributeBinding = ComponentAttributeBinding;
exports.ComponentFactory = ComponentFactory;
exports.SingletonComponentFactory = SingletonComponentFactory;
exports.createFactory = createFactory;
exports.extendComponent = extendComponent;

function Component(parent, context, id, scope) {
  this.parent = parent;
  this.context = context;
  this.id = id;
  this._scope = scope;
}

util.mergeInto(Component.prototype, Controller.prototype);

Component.prototype.destroy = function() {
  this.emit('destroy');
  this.model.removeContextListeners();
  this.model.destroy();
  delete this.page._components[this.id];
  var components = this.page._eventModel.object.$components;
  if (components) delete components.object[this.id];
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
  this.context.parent.attributes[key] = value;
};

Component.prototype.setNullAttribute = function(key, value) {
  var attributes = this.context.parent.attributes;
  if (attributes[key] == null) attributes[key] = value;
};

function ComponentAttribute(expression, model, key) {
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
  return (constructor.prototype.singleton) ?
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

function ComponentFactory(constructor) {
  this.constructor = constructor;
}
ComponentFactory.prototype.init = function(context) {
  var component = new this.constructor();

  var parent = context.controller;
  var id = context.id();
  var scope = ['$components', id];
  var model = parent.model.root.eventContext(component);
  model._at = scope.join('.');
  model.set('id', id);
  // Store a reference to the component's scope such that the expression
  // getters are relative to the component
  model.data = model.get();
  parent.page._components[id] = component;

  var componentContext = context.componentChild(component);
  Controller.call(component, parent.app, parent.page, model);
  Component.call(component, parent, componentContext, id, scope);
  setModelAttributes(componentContext, model);

  // Do the user-specific initialization. The component constructor should be
  // an empty function and the actual initialization code should be done in the
  // component's init method. This means that we don't have to rely on users
  // properly calling the Component constructor method and avoids having to
  // play nice with how CoffeeScript extends class constructors
  emitInitHooks(context, component);
  component.emit('init', component);
  if (component.init) component.init(model);

  return componentContext;
};
ComponentFactory.prototype.create = function(context) {
  var component = context.controller;
  component.emit('create', component);
  // Call the component's create function after its view is rendered
  if (component.create) {
    component.create(component.model, component.dom);
  }
};

function SingletonComponentFactory(constructor) {
  this.constructor = constructor;
  this.component = null;
}
SingletonComponentFactory.prototype.init = function(context) {
  if (!this.component) this.component = new this.constructor();
  return context.componentChild(this.component);
};
// Don't call the create method for singleton components
SingletonComponentFactory.prototype.create = function() {};

function extendComponent(constructor) {
  // Don't do anything if the constructor already extends Component
  if (constructor.prototype instanceof Component) return;
  // Otherwise, replace its prototype with an instance of Component
  var oldPrototype = constructor.prototype;
  constructor.prototype = new Component();
  util.mergeInto(constructor.prototype, oldPrototype);
}
