module.exports = {
  construct: construct
, pageInit: pageInit
};

function construct(name, proto) {
  function Collection(page) {
    return createCollection(page, name, proto);
  }
  // Keep a map of defined collections so that they can
  // be reinitialized from their name on the client
  this._Collections[name] = Collection;
  // This makes it possible to subscribe to the entire collection
  // by making it look like a scoped model
  Collection._at = name;
  // TODO: Query builder on the collection
  return Collection;
}

function createCollection(page, name, proto) {
  // Collections are actually just scoped models for now
  var _super = page.model.at(name)
    , collection = Object.create(_super)

  // Mixin collection specific methods
  collection._super = _super;
  collection.page = page;
  for (key in proto) {
    collection[key] = proto[key];
  }

  // Make collection available on the page for use in
  // event callbacks and other functions
  page[name] = collection;

  // Keep track of collections that were created so that
  // they can be recreated on the client if first rendered
  // on the server
  page._collections.push(name);

  return collection;
}

function pageInit() {
  var i = 0
    , len = arguments.length
    , items = []
    , item
  // All collections are created first before any of their
  // init methods are called. That way collections created
  // together can rely on each other being available for use
  for (i = 0; i < len; i++) {
    item = arguments[i](this);
    items.push(item);
  }
  // Call the init method of each collection if defined
  for (i = 0; i < len; i++) {
    item = items[i];
    if (item.hasOwnProperty('init')) {
      item.init();
    }
  }
}
