var EventEmitter = require('events').EventEmitter;
var contexts = require('derby-expressions').contexts;
var EventModel = require('./eventmodel');
var util = require('racer').util;

module.exports = Page;

function Page(app, model, req, res) {
  EventEmitter.call(this);
  this.app = app;
  this.model = model;
  this.req = req;
  this.res = res;
  this.eventModel = new EventModel();
  this.context = this._createContext();
}

// Inherit from the global object so that global functions and constructors are
// available for use as template helpers
Page.prototype = (function() {
  function Global() {};
  Global.prototype = global;
  return new Global();
})();

util.mergeInto(Page.prototype, EventEmitter.prototype);

// It's important that the page controller doesn't have a parent, since this
// could cause an infinite loop in controller function lookup
Page.prototype.parent = null;

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

Page.prototype._setRenderParams = function(ns) {
  this.model.set('$render.ns', ns);
  var url = (this.req) ? this.req.url :
    (global.location) ? global.location.href : '';
  this.model.set('$render.url', url);
};

Page.prototype._setRenderPrefix = function(ns) {
  var prefix = (ns) ? ns + ':' : '';
  this.model.set('$render.prefix', prefix);
};

Page.prototype.get = function(viewName, ns) {
  this._setRenderPrefix(ns);
  var view = this.getView(viewName, ns);
  return view.get(this.context, view.string);
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
  this._setRenderParams(ns);
  // ...
};

Page.prototype.attach = function() {
  var ns = this.model.get('$render.ns');
  var view = this.getView('Page', ns);
  view.attachTo(document, document.firstChild, this.context);
};

Page.prototype._createContext = function() {
  var eventModel = this.eventModel;
  if (this.model) {
    var onChange = function onChange(path) {
      var segments = util.castSegments(path.split('.'));
      eventModel.setAt(segments);
    };
    this.model.on('change', '**', onChange);
    this.model.on('load', '**', onChange);
    this.model.on('unload', '**', onChange);
    this.model.on('insert', '**', function onInsert(path, index, values) {
      var segments = util.castSegments(path.split('.'));
      eventModel.insertAt(segments, index, values.length);
    });
    this.model.on('remove', '**', function onRemove(path, index, values) {
      var segments = util.castSegments(path.split('.'));
      eventModel.removeAt(segments, index, values.length);
    });
    this.model.on('move', '**', function onMove(path, from, to, howMany) {
      var segments = util.castSegments(path.split('.'));
      eventModel.moveAt(segments, from, to, howMany);
    });
  }

  function addBinding(binding) {
    var expressions = binding.template.expressions;
    if (expressions) {
      for (var i = 0, len = expressions.length; i < len; i++) {
        addDependencies(expressions[i], binding);
      }
    } else {
      addDependencies(binding.template.expression, binding);
    }
  }
  function addDependencies(expression, binding) {
    var dependencies = expression.dependencies(binding.context);
    console.log(expression, dependencies, binding);
    if (!dependencies) return;
    for (var i = 0, len = dependencies.length; i < len; i++) {
      eventModel.addBinding(dependencies[i], binding);
    }
  }
  function removeBinding(binding) {
    eventModel.removeBinding(binding);
  }
  var contextMeta = new contexts.ContextMeta({
    addBinding: addBinding
  , removeBinding: removeBinding
  , views: this.app && this.app.views
  });
  return new contexts.Context(contextMeta, this);
};

util.serverRequire(__dirname + '/Page.server');
