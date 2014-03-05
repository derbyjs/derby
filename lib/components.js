/*
 * components.js
 *
 * Components associate custom script functionality with a view. They can be
 * distributed as standalone modules containing templates, scripts, and styles.
 * They can also be used to modularize application functionality.
 *
 */

var path = require('path');
var util = require('racer').util;
var derbyTemplates = require('derby-templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var App = require('./App');
var Controller = require('./Controller');

exports.Component = Component;
exports.ComponentFactory = ComponentFactory;
exports.SingletonComponentFactory = SingletonComponentFactory;
exports.createFactory = createFactory;

function Component(id, model, parent) {
  this.id = id;
  this.model = model;
  this.parent = parent;
  this.page = parent && parent.page;
  this.app = this.page && this.page.app;
  this._scope = ['$components', id];
}

util.mergeInto(Component.prototype, Controller.prototype);

Component.prototype.destroy = function() {
  this.emit('destroy');
};

function createComponent(Constructor, context, componentContext, parent, attributes) {
  var id = context.id();
  var scope = '$components.' + id;
  var root = context.controller.model.root;
  var model = root.scope(scope);
  model.set('id', id);
  // Store a reference to the component's scope such that the expression
  // getters are relative to the component
  model.data = model.get();

  // Render current attribute values and set on component model
  if (attributes) {
    for (var key in attributes) {
      var attribute = attributes[key];
      if (attribute instanceof templates.ParentWrapper) {
        var segments = attribute.expression && attribute.expression.pathSegments(context);
        if (segments) {
          root.ref(scope + '.' + key, segments.join('.'));
        } else {
          var value = attribute.get(componentContext);
          model.set(key, value);
        }
      } else if (typeof attribute === 'object') {
        var value = expressions.renderValue(attribute, componentContext);
        model.set(key, value);
      } else {
        model.set(key, attribute);
      }
    }
  }

  // Create the component instance. The component constructor should be an
  // empty function and the actual initialization code should be done in the
  // component's init method. This means that we don't have to rely on users
  // properly calling the Component constructor method and avoids having to
  // play nice with how CoffeeScript extends class constructors
  var component = componentContext.controller = new Constructor();
  Controller.call(component);
  Component.call(component, id, model, parent);
  component.page._components[id] = component;
  if (component.init) component.init(model);
  return component;
}

function emitHooks(context, component) {
  if (!context.hooks) return;
  // Kick off hooks if view pointer specified `on` or `as` attributes
  for (var i = 0, len = context.hooks.length; i < len; i++) {
    context.hooks[i].emit(context, component);
  }
}

function createFactory(constructor) {
  return (constructor.prototype.singleton) ?
    new SingletonComponentFactory(constructor) :
    new ComponentFactory(constructor);
}

function ComponentFactory(constructor) {
  this.constructor = constructor;
}
ComponentFactory.prototype.init = function(context) {
  var componentContext = context.componentChild();
  var component = createComponent(
    this.constructor,
    context,
    componentContext,
    context.controller,
    context.attributes
  );
  emitHooks(context, component);
  return componentContext;
};
ComponentFactory.prototype.create = function(context) {
  var component = context.controller;
  // Call the component's create function after its view is rendered
  if (component.create) component.create(component.model, component.dom);
};

function SingletonComponentFactory(constructor) {
  this.constructor = constructor;
  this.component = null;
  this.created = false;
}
SingletonComponentFactory.prototype.init = function(context) {
  var componentContext = context.componentChild();
  var component = this.component ||
    createComponent(this.constructor, context, componentContext);
  componentContext.controller = component;
  emitHooks(context, component);
  return componentContext;
};
SingletonComponentFactory.prototype.create = function(context) {
  var component = context.controller;
  // Call the component's create function after its view is rendered
  if (!this.created && component.create) component.create(component.model, component.dom);
  this.created = true;
};

App.prototype.component = function(viewName, constructor) {
  if (typeof viewName === 'function') {
    constructor = viewName;
    viewName = null;
  }

  // Inherit from Component
  extendComponent(constructor);

  // Load template view from filename
  if (constructor.prototype.view) {
    var viewFilename = constructor.prototype.view;
    viewName = path.basename(viewFilename, '.html');
    this.loadViews(viewFilename, viewName);

  } else if (!viewName) {
    if (constructor.prototype.name) {
      viewName = constructor.prototype.name;
      var view = this.views.register(viewName);
      view.template = templates.emptyTemplate;
    } else {
      throw new Error('No view name specified for component');
    }
  }

  // Associate the appropriate view with the component type
  var view = this.views.find(viewName);
  if (!view) {
    var message = this.views.findErrorMessage(viewName);
    throw new Error(message);
  }
  view.componentFactory = createFactory(constructor);

  // Make chainable
  return this;
};

function extendComponent(constructor) {
  // Don't do anything if the constructor already extends Component
  if (constructor.prototype instanceof Component) return;
  // Otherwise, replace its prototype with an instance of Component
  var oldPrototype = constructor.prototype;
  constructor.prototype = new Component();
  util.mergeInto(constructor.prototype, oldPrototype);
}
