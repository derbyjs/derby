var contexts = require('derby-expressions').contexts;
var util = require('racer').util;

module.exports = Page;

function Page(app, model, req, res) {
  this.app = app;
  this.model = model;
  this.req = req;
  this.res = res;
  this.isStatic = false;
  this.context = this._createContext();
}

Page.prototype.get = function(name) {
  var view = this.app.views.find(name);
  return view.get(this.context, view.string);
};

Page.prototype.getFragment = function(name) {
  var view = this.app.views.find(name);
  return view.getFragment(this.context);
};

Page.prototype.render = function(name) {

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
