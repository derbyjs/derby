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

function Component(id, model, parent) {
  Controller.call(this);
  this.id = id;
  this.model = model;
  this.parent = parent;
  this._scope = ['$components', id];
}

util.mergeInto(Component.prototype, Controller.prototype);

function ComponentFactory(constructor) {
  this.constructor = constructor;
}

ComponentFactory.prototype.init = function(context) {
  var parent = context.controller;
  var id = context.id();
  var scope = '$components.' + id;
  var root = parent.model.root;
  var model = root.scope(scope);
  var componentContext = context.componentChild();
  model.set('id', id);
  // Store a reference to the component's scope such that the expression
  // getters are relative to the component
  model.data = model.get();

  // Render current attribute values and set on component model
  var attributes = context.attributes;
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
  var component = componentContext.controller = new this.constructor();
  Component.call(component, id, model, parent);
  if (component.init) component.init(model);

  // Kick off hooks if view pointer specified `on` or `as` attributes
  if (context.hooks) {
    for (var i = 0, len = context.hooks.length; i < len; i++) {
      context.hooks[i].emit(context, component);
    }
  }

  // Emit 'init' event, which can be useful in the parent page or component
  component.emit('init', component);
  return componentContext;
};

ComponentFactory.prototype.create = function(context) {
  var component = context.controller;

  // Call the component's create function after its view is rendered
  if (component.create) component.create(component.model, component.dom);

  // Emit 'create' event, which can be useful in the parent page or component
  component.emit('create', component);
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
  }

  // Associate the appropriate view with the component type
  view = this.views.find(viewName);
  if (!view) {
    var message = this.views.findErrorMessage(viewName);
    throw new Error(message);
  }
  view.componentFactory = new ComponentFactory(constructor);

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
