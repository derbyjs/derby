/*
 * components.js
 *
 * Components associate custom script functionality with a view. They can be
 * distributed as standalone modules containing templates, scripts, and styles.
 * They can also be used to modularize application functionality.
 *
 */

var path = require('path');
var util = require('racer/lib/util');
var derbyTemplates = require('derby-templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var App = require('./App');
var Controller = require('./Controller');

exports.Component = Component;
exports.ComponentFactory = ComponentFactory;
exports.SingletonComponentFactory = SingletonComponentFactory;
exports.createFactory = createFactory;

function Component(id, parent) {
  this.id = id;
  this.parent = parent;
  this._scope = ['$components', id];
}

util.mergeInto(Component.prototype, Controller.prototype);

Component.prototype.destroy = function() {
  this.emit('destroy');
};

function initComponent(component, context, componentContext, attributes) {
  var id = context.id();
  var scope = '$components.' + id;
  var parent = context.controller;
  var root = parent.model.root;
  var model = root.scope(scope);
  model.set('id', id);
  // Store a reference to the component's scope such that the expression
  // getters are relative to the component
  model.data = model.get();
  // Do generic controller initialization
  Controller.call(component, parent.app, parent.page, model);
  Component.call(component, id, parent);

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

  // Do the user-specific initialization. The component constructor should be
  // an empty function and the actual initialization code should be done in the
  // component's init method. This means that we don't have to rely on users
  // properly calling the Component constructor method and avoids having to
  // play nice with how CoffeeScript extends class constructors
  emitHooks(context, component);
  component.emit('init', component);
  if (component.init) component.init(model);
  component.page._components[component.id] = component;
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
  var component = new this.constructor();
  var componentContext = context.componentChild(component);
  initComponent(component, context, componentContext, context.attributes);
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
  var componentContext;
  if (this.component) {
    componentContext = context.componentChild(this.component);
    emitHooks(context, this.component);
  } else {
    this.component = new this.constructor();
    componentContext = context.componentChild(this.component);
    initComponent(this.component, context, componentContext);
  }
  return componentContext;
};
// Don't call the create method for singleton components
SingletonComponentFactory.prototype.create = function() {};

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
    viewName = constructor.prototype.name || path.basename(viewFilename, '.html');
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
