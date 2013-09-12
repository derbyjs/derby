
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

module.exports = EventModel;

// The code here uses object-based set pattern where objects are keyed using
// sequentially generated IDs.
var nextId = 1;

var getAtPath = function(data, path) {
  for (var i = 0; i < path.length; i++) {
    data = data[path[i]];
    if (data == null) {
      return data;
    }
  }
  return data;
};

function expandSegments(segments) {
  var result = new Array(segments.length);
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    result[i] = typeof segment === 'object' ? segment.item : segment;
  }

  return result;
}




// A binding object is something with update(), insert()/move()/remove() defined.


// Given x[y] with model.get(y) == 5:
//  item = 5
//  segments = ['y']
//  outside = the EventModel for x.
//
// Note that item could be a Context or another ModelRef - eg:
//
// {{ each foo as bar }} ... {{ x[bar] }}  -or-  {{ x[y[z]] }}
function ModelRef(model, item, segments, outside) {
  this.id = nextId++;

  // We need a reference to the model & our segment list so we can update our
  // value.
  this.model = model;
  this.segments = segments;
 
  // Our current value.
  this.item = item;

  // outside is a reference to the EventModel of the thing on the lhs of the
  // brackets. For example, in x[y].z, outside is the EventModel of x.
  this.outside = outside;

  // result is the EventModel of the evaluated version of the brackets. In
  // x[y].z, its the EventModel of x[y].
  this.result = outside.child(item).refChild(this);
};

ModelRef.prototype.update = function() {
  // First remove myself.
  delete this.outside.child(this.item).refChildren[this.id];

  this.item = this.model._get(expandSegments(this.segments));

  var container = this.outside.child(this.item);
  // I want to just call refChild but that would create a new EM. Instead I
  // want to just implant my current EM there.
  if (container.refChildren == null) container.refChildren = {};
  container.refChildren[this.id] = this.result;

  // Finally, update all the bindings in the tree.
  this.result.update();
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

  this.id = nextId++;
  
  // Most of these won't ever be filled in, so I'm just leaving them null.
  //
  // These contain our EventModel children.
  this.object = null;
  this.array = null;

  // This contains any EventModel children which have floating references.
  this.arrayByReference = null;

  // If the data stored here is ever used to lookup other values, this is an
  // object mapping remote child ID -> ref.
  //
  // Eg given x[y], y.refOut[x.id] = <Binding>
  this.refOut = null;

  // This is a map from ref id -> event model for events bound to this
  // eventmodel but via a ref. We could just merge them into the main tree, but
  // this way they're easy to move.
  //
  // Eg, given x[y] (y=1), x.1.refChildren[ref id] is an eventmodel.
  this.refChildren = null;

  this.bindings = null;

  // Item contexts are contexts which need their item number changed as this
  // eventmodel object moves around its surrounding list.
  this.itemContexts = null;
}

EventModel.expandSegments = expandSegments;

EventModel.prototype.refChild = function(ref) {
  if (!this.refChildren) this.refChildren = {};
  var id = ref.id;

  if (!this.refChildren[id]) {
    this.refChildren[id] = new EventModel(this.meta);
  }
  return this.refChildren[id];
};

EventModel.prototype.arrayLookup = function(model, segmentsBefore, segmentsInside) {
  var item = model._get(expandSegments(segmentsInside));

  var source = this.at(segmentsInside);

  // What the array currently resolves to. Given x[y] with y=1, container is
  // the EM for x
  var container = this.at(segmentsBefore);

  if (!source.refOut) source.refOut = {};

  var ref;
  if ((ref = source.refOut[container.id]) == null) {
    ref = new ModelRef(model, item, segmentsInside, container);
    source.refOut[container.id] = ref;
  }
  
  return ref;
};

// Returns the EventModel node of the named child.
EventModel.prototype.child = function(segment) {
  var container;
  switch(typeof segment) {
    case 'string':
      // Object
      if (!this.object) this.object = {};
      container = this.object;
      break;
    case 'number':
      // Array by value
      if (!this.array) this.array = [];
      container = this.array;
      break;
    case 'object':
      // I much prefer duck typing... no matter. Here segments could either be
      // array references or item contexts. (Ugh.)
      if (segment instanceof ModelRef) {
        // Array reference. We'll need to lookup the child with the right
        // value, then look inside its ref children for the right EventModel
        // (so we can update it later). This is pretty janky, but should be
        // *correct* even in the face of recursive array accessors.
        //
        // This will calculate it based on the current segment values, but refs
        // cache the EM anyway.
        //return this.child(segment.item).refChild(segment);
        return segment.result;
      } else {
        // Array by reference
        if (!this.arrayByReference) this.arrayByReference = [];
        container = this.arrayByReference;
        segment = segment.item;
      }
      break;
  }

  if (!container[segment]) {
    container[segment] = new EventModel(this.meta);
  }

  return container[segment];
};

// Returns the EventModel node at the given segments list. Note that although
// EventModel nodes are unique, its possible for multiple EventModel nodes to
// refer to the same section of the model because of references.
//
// If you want to update the bindings that refer to a specific path, use
// each().
//
// EventModel objects are created as needed.
EventModel.prototype.at = function(segments) {
  // For unbound dependancies.
  if (segments == null) return this;

  var model = this;

  for (var i = 0; i < segments.length; i++) {
    model = model.child(segments[i]);
  }

  return model;
};

EventModel.prototype.isEmpty = function() {
  if (!isEmpty(this.dependancies)) return false;
  if (!isEmpty(this.itemContexts)) return false;

  if (this.object) {
    for (var k in this.object) return false;
    this.object = null;
  }

  if (this.arrayByReference) {
    for (var i = 0; i < this.arrayByReference.length; i++) {
      if (this.arrayByReference[i] != null) return false;
    }

    this.arrayByReference = null;
  }

  if (this.array) {
    for (var i = 0; i < this.array.length; i++) {
      if (this.array[i] != null) return false;
    }

    this.array = null;
  }

  return true;
};


// **** Updating the eventmodel

EventModel.prototype._addItemContext = function(context) {
  if (!context._id) context._id = nextId++;
  if (!this.itemContexts) this.itemContexts = {};
  this.itemContexts[context._id] = context;
};

EventModel.prototype._removeItemContext = function(context) {
  if (this.itemContexts) {
    delete this.itemContexts[context._id];
  }
};

EventModel.prototype._addBinding = function(binding) {
  //if (!this.dependancies) this.dependancies = {};
  //var dep = new Dependancy(function() { return [];}, this, null)

  if (!binding.id) binding.id = nextId++;
  if (!this.bindings) this.bindings = {};
  this.bindings[binding.id] = binding;
};

EventModel.prototype._removeBinding = function(binding) {
  if (this.bindings) {
    delete this.bindings[binding.id];
  }
};

// This is the main hook to add bindings to the event model tree. It should
// only be called on the root eventmodel object.
EventModel.prototype.addBinding = function(segments, binding) {
  //var context = binding.context;
  //var expression = binding.template.expression;
  //var container = this.at(expression.resolve(context)); 
 
  var container = this.at(segments);

  if (binding.isItem) {
    //console.log('added item binding', context.item, segments);

    container._addItemContext(context);
  } else {
    //console.log('added binding', segments);

    //console.log(container);
    container._addBinding(binding);
  }
};

EventModel.prototype.removeBinding = function(binding) {
  var context = binding.context;
  var expression = binding.template.expression;

  if (binding.isItem) {
    console.log('remove item binding', context.item, expression.resolve(context));

    var container = this.at(expression.resolve(context));

    //container._addItemContext(context);
  } else {
    console.log('remove binding', expression.resolve(context));

    var dependencies = expression.dependencies(context);

    for (var i = 0; i < dependencies.length; i++) {
      //var container = em.at(dependencies[i]);
      //container._addBinding(binding);
    }
  }

};

EventModel.prototype._each = function(segments, pos, fn) {
  // Our refChildren are effectively merged into this object.
  if (this.refChildren) {
    for (var id in this.refChildren) {
      this.refChildren[id]._each(segments, pos, fn);
    }
  }

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
    if (this.array && (child = this.array[segment]))
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

// Called when the scalar value at the path changes. This only calls update()
// on this node. See update() below if you want to update entire
// subtrees.
EventModel.prototype.localUpdate = function() {
  if (this.bindings) for (var id in this.bindings) {
    if (!this.bindings[id].removed)
      this.meta.update(this.bindings[id]);
  }

  // If our value changed, we also need to update anything that depends on it
  // via refOut.
  if (this.refOut) for (var id in this.refOut) {
    var ref = this.refOut[id];
    ref.update();
  }
};

// This is used when an object subtree is replaced / removed.
EventModel.prototype.update = function() {
  this.localUpdate();

  if (this.object) {
    for (var key in this.object) {
      this.object[key].update();
    }
  }

  if (this.array) {
    for (var i = 0; i < this.array.length; i++) {
      if (this.array[i]) this.array[i].update();
    }
  }

  if (this.arrayByReference) {
    for (var i = 0; i < this.arrayByReference.length; i++) {
      this.arrayByReference[i].update();
    }
  }
};

// Updates the indexes in itemContexts of our children in the range of
// [from, to). from and to both optional.
EventModel.prototype._updateChildItemContexts = function(from, to) {
  if (!this.arrayByReference) return;

  if (from == null) from = 0;
  if (to == null) to = this.arrayByReference.length;

  for (var i = from; i < to; i++) {
    if (!this.arrayByReference[i] || !this.arrayByReference[i].itemContexts)
      continue;

    var contexts = this.arrayByReference[i].itemContexts;
    for (var c = 0; c < contexts.length; c++) {
      contexts[c].item = i;
    }
  }
};

// Updates our array-by-value values. They have to recursively update every
// binding in their children. Sad.
EventModel.prototype._updateArray = function(from, to) {
  if (!this.array) return;

  if (from == null) from = 0;
  if (to == null) to = this.array.length;

  for (var i = from; i < to; i++) {
    if (this.array[i]) this.array[i].update();
  }
};

EventModel.prototype._updateObject = function() {
  if (this.object) for (var key in this.object) {
    this.object[key].update();
  }
};

EventModel.prototype.set = function() {
  // This just updates anything thats bound to the whole subtree. An alternate
  // implementation could be passed in the new value at this node (which we
  // cache), then compare with the old version and only update parts of the
  // subtree which are relevant. I don't know if thats an important
  // optimization - it really depends on your use case.
  this.update();
};

// Insert into this eventmodel node.
EventModel.prototype.insert = function(index, howMany) {
  if (typeof index !== 'number') throw Error('Just call update() instead of insert() for object updates');

  // Update fixed paths
  this._updateArray(index);

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
  if (this.bindings) for (var id in this.bindings) {
    var b = this.bindings[id];
    if (b) this.meta.insert(b, index, howMany);
  }
  this._updateObject();
};

// Remove howMany child elements from this EventModel at index.
EventModel.prototype.remove = function(index, howMany) {
  if (typeof index === 'string') {
    // Remove from object map
    if (this.object && this.object[index]) {
      this.object[index].update();
    }
    delete this.object[index];
  } else {
    // Update fixed paths. Both the removed items and items after it may have changed.
    this._updateArray(index);

    if (this.arrayByReference) {
      // Update relative paths. First throw away all the children which have been removed.
      this.arrayByReference.splice(index, howMany);

      this._updateChildItemContexts(index);
    }
  }

  // Call bindings.
  if (this.bindings) for (var id in this.bindings) {
    var b = this.bindings[id];
    if (b) this.meta.remove(b, index, howMany);
  }
  this._updateObject();
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
  this._updateArray(first, end);

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
  if (this.bindings) for (var id in this.bindings) {
    var b = this.bindings[id];
    if (b) this.meta.move(b, from, to, howMany);
  }
  this._updateObject();
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

