
// The many trees of bindings:
//
// - Model tree, containing your actual data. Eg:
//    {users:{fred:{age:40}, wilma:{age:37}}}
//
// - Event model tree, whose structure mirrors the model tree. The event model
//   tree lets us annotate the model tree with listeners which fire when events
//   change. I think there are three types of listeners:
//
//   1. Reference binding binds to whatever is referred to by the path. Eg,
//   {{each items as item}} binds item by reference as it goes through the
//   list.
//   2. Fixed path bindings explicitly bind to whatever is at that path
//   regardless of how the model changes underneath the event model
//   3. Listen on a subtree and fire when anything in the subtree changes. This
//   is used for custom functions.
//
// {{foo.id}} would listen on the fixed path ['foo', 'id'].
//
//
// - Context tree represents the changing (embedded) contexts of the templating
//   engine. This maps to the tree of templates and allows templates to reference
//   anything in any of their enclosing template scopes.
//


var getAtPath = function(data, path) {
  for (var i = 0; i < path.length; i++) {
    data = data[path[i]];
    if (data == null) {
      return data;
    }
  }
  return data;
};

function EventModelMeta() {}

EventModelMeta.prototype.update = function(binding) {
  binding.update();
};

EventModelMeta.prototype.insert = function(binding, index, howMany) {
  if (binding.insert) {
    binding.insert(index, howMany);
  } else {
    binding.update();
  }
};

EventModelMeta.prototype.remove = function(binding, index, howMany) {
  if (binding.remove) {
    binding.remove(index, howMany);
  } else {
    binding.update();
  }
};

EventModelMeta.prototype.move = function(binding, from, to, howMany) {
  if (binding.move) {
    binding.move(from, to, howMany);
  } else {
    binding.update();
  }
};

function EventModel(meta) {
  this.meta = meta || new EventModelMeta();
  
  // Most of these won't ever be filled in, so I'm just leaving them null.
  this.object = null;
  this.arrayByReference = null;
  this.arrayByValue = null;

  // The bindings to this event model object.
  this.bindings = null;

  // Item contexts are contexts which need their item number changed as this
  // eventmodel object moves around its surrounding list.
  this.itemContexts = null;
}

EventModel.prototype._getInContainer = function(segment, container) {
  if (!container[segment]) {
    container[segment] = new EventModel(this.meta);
  }
 
  return container[segment];
};

EventModel.prototype.getContainerAt = function(segments) {
  var model = this;
  var data = this.data;

  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];

    var container;
    switch(typeof segment) {
      case 'string':
        // Object
        if (!model.object) model.object = {};
        container = model.object;
        break;
      case 'number':
        // Array by value
        if (!model.arrayByValue) model.arrayByValue = [];
        container = model.arrayByValue;
        break;
      case 'object':
        // Array by reference
        if (!model.arrayByReference) model.arrayByReference = [];
        container = model.arrayByReference;
        segment = segment.item;
        break;
    }

    // A reference to the child's current data binding.
    model = this._getInContainer(segment, container);
  }

  return model;
};


// **** Updating the eventmodel

EventModel.prototype.addItemContext = function(context) {
  if (!this.itemContexts) this.itemContexts = [];
  this.itemContexts.push(context);
};

EventModel.prototype.addBinding = function(binding) {
  if (!this.bindings) this.bindings = [];
  this.bindings.push(binding);
};

EventModel.prototype._each = function(segments, pos, fn) {
  if (segments.length === pos) {
    fn(this);
    return;
  }

  var segment = segments[pos];
  var child;
  if (typeof segment === 'string') {
    // Object. Just recurse into our objects set. Its possible to rewrite this
    // function to simply loop in the case of object lookups, but I don't think
    // it'll buy us much.
    if (this.object && (child = this.object[segment]))
      child._each(segments, pos + 1, fn);
  } else {
    // Number. Recurse both into the fixed list and the reference list.
    if (this.arrayByValue && (child = this.arrayByValue[segment]))
      child._each(segments, pos + 1, fn);

    if (this.arrayByReference && (child = this.arrayByReference[segment]))
      child._each(segments, pos + 1, fn);
  }
};

// This finds & returns a list of all event models which exist and could match
// the specified path. The path cannot contain contexts like derby expression
// segment lists (just because I don't think thats a useful feature and its not
// implemented).
EventModel.prototype.each = function(segments, fn) {
  this._each(segments, 0, fn);
};

// Called when the scalar value at the path changes.
EventModel.prototype.update = function() {
  if (this.bindings) for (var i = 0; i < this.bindings.length; i++) {
    if (this.bindings[i] && !this.bindings[i].removed)
      this.meta.update(this.bindings[i]);
  }
};

// This is used when an object subtree is replaced / removed.
EventModel.prototype.recursiveUpdate = function() {
  this.update();

  if (this.object) for (var key in this.object) {
    this.object[key].recursiveUpdate();
  }

  if (this.arrayByValue) for (var i = 0; i < this.arrayByValue.length; i++) {
    this.arrayByValue[i].recursiveUpdate();
  }

  if (this.arrayByReference) for (var i = 0; i < this.arrayByReference.length; i++) {
    this.arrayByReference[i].recursiveUpdate();
  }
};

// Updates the indexes in itemContexts of our children in the range of
// [from, to). from and to both optional.
EventModel.prototype._updateChildItemContexts = function(from, to) {
  if (!this.arrayByReference) return;

  if (from == null) from = 0;
  if (to == null) to = this.arrayByReference.length;

  for (var i = from; i < to; i++) {
    if (!this.arrayByReference[i] || !this.arrayByReference[i].itemContexts) continue;

    var contexts = this.arrayByReference[i].itemContexts;
    for (var c = 0; c < contexts.length; c++) {
      contexts[c].item = i;
    }
  }
};

// Updates our array-by-value values. They have to recursively update every
// binding in their children. Sad.
EventModel.prototype._updateArrayByValue = function(from, to) {
  if (!this.arrayByValue) return;

  if (from == null) from = 0;
  if (to == null) to = this.arrayByValue.length;

  for (var i = from; i < to; i++) {
    if (this.arrayByValue[i]) this.arrayByValue[i].recursiveUpdate();
  }
};

EventModel.prototype.set = function() {
  // This just updates anything thats bound to the whole subtree. An alternate
  // implementation could be passed in the new value at this node (which we
  // cache), then compare with the old version and only update parts of the
  // subtree which are relevant. I don't know if thats an important
  // optimization - it really depends on your use case.
  this.recursiveUpdate();
};

// Insert into this eventmodel node.
EventModel.prototype.insert = function(index, howMany) {
  if (typeof index !== 'number') throw Error('Just call update() instead of insert() for object updates');

  // Update fixed paths
  this._updateArrayByValue(index);

  // Update relative paths
  if (this.arrayByReference && this.arrayByReference.length > index) {
    // Shift the actual items in the array references array.

    // This probably isn't the best way to implement insert. Other options are
    // using concat() on slices or though constructing a temporary array and
    // using splice.call. Hopefully if this method is slow it'll come up during
    // profiling.
    for (var i = 0; i < howMany; i++) {
      this.arrayByReference.splice(index, 0, null);
    }

    // Update the path in the contexts
    this._updateChildItemContexts(index + howMany);
  }

  // Finally call our bindings.
  if (this.bindings) for (var i = 0; i < this.bindings.length; i++) {
    var b = this.bindings[i];
    if (b) this.meta.insert(b, index, howMany);
  }
};

// Remove howMany child elements from this EventModel at index.
EventModel.prototype.remove = function(index, howMany) {
  if (typeof index === 'string') {
    // Remove from object map
    if (this.object && this.object[index]) {
      this.object[index].recursiveUpdate();
    }
    delete this.object[index];
  } else {
    // Update fixed paths. Both the removed items and items after it may have changed.
    this._updateArrayByValue(index);

    if (this.arrayByReference) {
      // Update relative paths. First throw away all the children which have been removed.
      this.arrayByReference.splice(index, howMany);

      this._updateChildItemContexts(index);
    }
  }

  // Call bindings.
  if (this.bindings) for (var i = 0; i < this.bindings.length; i++) {
    var b = this.bindings[i];
    if (b) this.meta.remove(b, index, howMany);
  }
};

// Move howMany items from `from` to `to`.
EventModel.prototype.move = function(from, to, howMany) {
  if (typeof from !== 'number') throw Error('move using string from/to not supported');

  if (from === to || howMany === 0) return;

  // first points to the first element that was moved. end points to the list
  // element past the end of the changed region.
  var first, end;
  if (from < to) {
    first = from; end = to + howMany;
  } else {
    first = to; end = from + howMany;
  }

  // Update fixed paths.
  this._updateArrayByValue(first, end);

  // Update relative paths
  var arr = this.arrayByReference;
  if (arr && arr.length > first) {
    // Remove from the old location
    var values = arr.splice(from, howMany);

    // Insert at the new location
    arr.splice.apply(arr, [to, 0].concat(values));

    // Update the path in the contexts
    this._updateChildItemContexts(first, end);
  }

  // Finally call our bindings.
  if (this.bindings) for (var i = 0; i < this.bindings.length; i++) {
    var b = this.bindings[i];
    if (b) this.meta.move(b, from, to, howMany);
  }
};


// Helpers.

EventModel.prototype.setAt = function(segments) {
  this.each(segments, function(child) { child.set(); });
};

EventModel.prototype.insertAt = function(segments, index, howMany) {
  this.each(segments, function(child) { child.insert(index, howMany); });
};

EventModel.prototype.removeAt = function(segments, index, howMany) {
  this.each(segments, function(child) { child.remove(index, howMany); });
};

EventModel.prototype.moveAt = function(segments, from, to, howMany) {
  this.each(segments, function(child) { child.move(from, to, howMany); });
};

