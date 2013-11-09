var contexts = require('derby-expressions').contexts;
var util = require('racer').util;

module.exports = Page;

function Page(app, model, req, res) {
  this.app = app;
  this.model = model;
  this.req = req;
  this.res = res;
  this.context = this._createContext();
}

Page.prototype.bodyClass = function(renderNs) {
  if (!renderNs) return;
  var classNames = [];
  var segments = renderNs.split(':');
  for (var i = 0, len = segments.length; i < len; i++) {
    var className = segments.slice(0, i + 1).join('-');
    classNames.push(className);
  }
  return classNames.join(' ');
};

Page.prototype._setRenderNs = function(ns) {
  var renderNs = (ns) ? 'app:' + ns : 'app';
  this.model.set('$render.ns', renderNs);
  return renderNs;
};

Page.prototype._setRenderPrefix = function(ns) {
  var prefix = (ns) ? ns + ':' : '';
  this.model.set('$render.prefix', prefix);
  return prefix;
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
  return this.app.views.find(viewName, ns && ns.split(':'));
};

Page.prototype.render = function(ns) {
  var renderNs = this._setRenderNs(ns);
  // ...
};

Page.prototype.attach = function() {
  var renderNs = this.model.get('$render.ns');
  var view = this.getView('Page', renderNs);
  view.attachTo(document, document.firstChild, this.context);
};

Page.prototype._createContext = function() {
  // TODO: Hook up to model events properly
  var bindings = {};
  var count = 0;
  function addBinding(binding) {
    var id = binding.id = ++count;
    bindings[id] = binding;
  }
  function removeBinding(binding) {
    delete bindings[binding.id];
  }
  // this.model.on('all', '**', function() {
  //   for (var id in bindings) {
  //     bindings[id].update();
  //   }
  // });

  var contextMeta = new contexts.ContextMeta({
    onAdd: addBinding
  , onRemove: removeBinding
  , views: this.app && this.app.views
  });
  return new contexts.Context(contextMeta, this);
};

util.serverRequire(__dirname + '/Page.server');
