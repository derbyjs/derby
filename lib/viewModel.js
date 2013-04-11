module.exports = {
  construct: construct
, pageInit: pageInit
};

function construct(name, proto) {
  function ViewModel(page) {
    return createViewModel(page, name, proto);
  }
  // Keep a map of defined viewModels so that they can
  // be reinitialized from their name on the client
  this._ViewModels[name] = ViewModel;
  // This makes it possible to subscribe to the entire viewModel
  // by making it look like a scoped model
  ViewModel._at = name;
  // TODO: Query builder on the viewModel
  return ViewModel;
}

function createViewModel(page, name, proto) {
  // ViewModels are actually just scoped models for now
  var _super = page.model.at(name)
    , viewModel = Object.create(_super)

  // Mixin viewModel specific methods
  viewModel._super = _super;
  viewModel.page = page;
  for (key in proto) {
    viewModel[key] = proto[key];
  }

  // Make viewModel available on the page for use in
  // event callbacks and other functions
  page[name] = viewModel;

  // Keep track of viewModels that were created so that
  // they can be recreated on the client if first rendered
  // on the server
  page._viewModels.push(name);

  return viewModel;
}

function pageInit() {
  var i = 0
    , len = arguments.length
    , items = []
    , item
  // All viewModels are created first before any of their
  // init methods are called. That way viewModels created
  // together can rely on each other being available for use
  for (i = 0; i < len; i++) {
    item = arguments[i](this);
    items.push(item);
  }
  // Call the init method of each viewModel if defined
  for (i = 0; i < len; i++) {
    item = items[i];
    if (item.hasOwnProperty('init')) {
      item.init();
    }
  }
}
