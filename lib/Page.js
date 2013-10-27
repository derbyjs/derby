var expressions = require('./expressions');
var util = require('racer/lib/util');

module.exports = Page;

function Page(app, model, req, res) {
  this.app = app;
  this.model = model || new app.derby.Model();
  this.req = req;
  this.res = res;
  this.isStatic = false;
  var contextMeta = createContextMeta(this);
  this.context = new expressions.Context(contextMeta, this.model);
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

function createContextMeta(page) {
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
  page.model.on('all', '**', function() {
    for (var id in bindings) {
      bindings[id].update();
    }
  });

  return new expressions.ContextMeta({
    onAdd: addBinding
  , onRemove: removeBinding
  , views: page.app.views
  , fns: page.app.views.fns
  });
}

util.serverRequire(__dirname + '/Page.server');
