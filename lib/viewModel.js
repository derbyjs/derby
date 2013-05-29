var paths = require('./paths');

module.exports = {
  construct: construct
};

function ViewModel(name, proto) {
  this.name = name;
  this.proto = proto;
}
ViewModel.prototype.init = function(page) {
  var args = Array.prototype.slice.call(arguments, 1);
  // ViewModels are actually just scoped models for now
  var _super = page.model.at(this.name);
  var viewModel = Object.create(_super);

  // Mixin viewModel specific methods
  viewModel._super = _super;
  viewModel.page = page;
  viewModel.model = page.model;
  for (key in this.proto) {
    if (key === 'init') continue;
    viewModel[key] = this.proto[key].bind(viewModel);
  }
  if (this.proto.init) {
    // Keep track of viewModels that were created so that
    // they can be recreated on the client if first rendered
    // on the server
    page._viewModels.push([this.name, args]);
    this.proto.init.apply(viewModel, args);
  }

  // Make viewModel available on the page for use in
  // event callbacks and other functions
  var segments = this.name.split('.');
  var last = segments.pop();
  var node = paths.traverseNode(page, segments);
  node[last] = viewModel;

  return viewModel;
}

function construct(name, proto) {
  // Keep a map of defined viewModels so that they can
  // be reinitialized from their name on the client
  var viewModel = this._viewModels[name] = new ViewModel(name, proto);
  return viewModel;
}
