import { type Model } from 'racer';

import { expressions } from './templates';
import { checkKeyIsSafe } from './templates/util';

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

// module.exports = EventModel;

// The code here uses object-based set pattern where objects are keyed using
// sequentially generated IDs.
let nextId = 1;

// A binding object is something with update(), insert()/move()/remove() defined.

// Given x[y] with model.get(y) == 5:
//  item = 5
//  segments = ['y']
//  outside = the EventModel for x.
//
// Note that item could be a Context or another ModelRef - eg:
//
// {{ each foo as bar }} ... {{ x[bar] }}  -or-  {{ x[y[z]] }}
class ModelRef{
  id: number;
  model: Model;
  segments: string[];
  item: any;
  outside: any;
  result: any;
  
  constructor(model, item, segments, outside) {
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
  }
  
  update() {
    const segments = expressions.pathSegments(this.segments);
    const newItem = expressions.lookup(segments, this.model.data);
    if (this.item === newItem) return;
  
    // First remove myself.
    delete this.outside.child(this.item).refChildren[this.id];
  
    this.item = newItem;
  
    const container = this.outside.child(this.item);
    // I want to just call refChild but that would create a new EM. Instead I
    // want to just implant my current EM there.
    if (!container.refChildren) container.refChildren = new RefChildrenMap();
    container.refChildren[this.id] = this.result;
  
    // Finally, update all the bindings in the tree.
    this.result.update();
  }
}


class RefOutMap {}
class RefChildrenMap {}
class BindingsMap {}
class ItemContextsMap {}
class EventModelsMap {}

function hasKeys(object) {
  for (const key in object) {
    return true;
  }
  return false;
}
 
function childSetWildcard(child) {
  child._set();
}

export class EventModel {
  array: any;
  arrayByReference: any;
  bindings: BindingsMap | null;
  dependancies: any;
  id: number;
  itemContexts: ItemContextsMap | null;
  object: any;
  refChildren: RefChildrenMap | null;
  refOut: RefOutMap | null;

  constructor() {
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
    // EventModel but via a ref. We could just merge them into the main tree, but
    // this way they're easy to move.
    //
    // Eg, given x[y] (y=1), x.1.refChildren[ref id] is an EventModel.
    this.refChildren = null;

    this.bindings = null;

    // Item contexts are contexts which need their item number changed as this
    // EventModel object moves around its surrounding list.
    this.itemContexts = null;
  }

  refChild(ref) {
    if (!this.refChildren) this.refChildren = new RefChildrenMap();
    const id = ref.id;
  
    if (!this.refChildren[id]) {
      this.refChildren[id] = new EventModel();
    }
    return this.refChildren[id];
  }
  
  arrayLookup(model, segmentsBefore, segmentsInside) {
    const segments = expressions.pathSegments(segmentsInside);
    const item = expressions.lookup(segments, model.data);
  
    const source = this.at(segmentsInside);
  
    // What the array currently resolves to. Given x[y] with y=1, container is
    // the EM for x
    const container = this.at(segmentsBefore);
  
    if (!source.refOut) source.refOut = new RefOutMap();
  
    let ref = source.refOut[container.id];
    if (ref == null) {
      ref = new ModelRef(model, item, segmentsInside, container);
      source.refOut[container.id] = ref;
    }
  
    return ref;
  }
  
  // Returns the EventModel node of the named child.
  child(segment) {
    let container;
    if (typeof segment === 'string') {
      // Object
      if (!this.object) this.object = {};
      container = this.object;
  
    } else if (typeof segment === 'number') {
      // Array by value
      if (!this.array) this.array = [];
      container = this.array;
  
    } else if (segment instanceof ModelRef) {
      // Array reference. We'll need to lookup the child with the right
      // value, then look inside its ref children for the right EventModel
      // (so we can update it later). This is pretty janky, but should be
      // *correct* even in the face of recursive array accessors.
      //
      // This will calculate it based on the current segment values, but refs
      // cache the EM anyway.
      //return this.child(segment.item).refChild(segment);
      return (segment as any).result;
  
    } else {
      // Array by reference
      if (!this.arrayByReference) this.arrayByReference = [];
      container = this.arrayByReference;
      segment = segment.item;
    }
  
    checkKeyIsSafe(segment);
    return container[segment] || (container[segment] = new EventModel());
  }
  
  // Returns the EventModel node at the given segments list. Note that although
  // EventModel nodes are unique, its possible for multiple EventModel nodes to
  // refer to the same section of the model because of references.
  //
  // If you want to update the bindings that refer to a specific path, use
  // each().
  //
  // EventModel objects are created as needed.
  at(segments) {
    // For unbound dependancies.
    if (segments == null) return this;
  
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let eventModel = this;
  
    for (let i = 0; i < segments.length; i++) {
      eventModel = eventModel.child(segments[i]);
    }
  
    return eventModel;
  }
  
  isEmpty() {
    if (hasKeys(this.dependancies)) return false;
    if (hasKeys(this.itemContexts)) return false;
  
    if (this.object) {
      if (hasKeys(this.object)) return false;
      this.object = null;
    }
  
    if (this.arrayByReference) {
      for (let i = 0; i < this.arrayByReference.length; i++) {
        if (this.arrayByReference[i] != null) return false;
      }
      this.arrayByReference = null;
    }
  
    if (this.array) {
      for (let i = 0; i < this.array.length; i++) {
        if (this.array[i] != null) return false;
      }
      this.array = null;
    }
  
    return true;
  }
  
  // **** Updating the EventModel
  
  _addItemContext(context) {
    if (!context._id) context._id = nextId++;
    if (!this.itemContexts) this.itemContexts = new ItemContextsMap();
    this.itemContexts[context._id] = context;
  }
  
  _removeItemContext(context) {
    if (this.itemContexts) {
      delete this.itemContexts[context._id];
    }
  }
  
  _addBinding(binding) {
    if (this.bindings == null) {
      this.bindings = new BindingsMap();
    }
    const bindings = this.bindings;
    if (binding.eventModels == null) {
      binding.eventModels = new EventModelsMap();
    }
    bindings[binding.id] = binding;
    binding.eventModels[this.id] = this;
  }
  
  // This is the main hook to add bindings to the event model tree. It should
  // only be called on the root EventModel object.
  addBinding(segments, binding) {
    this.at(segments)._addBinding(binding);
  }
  
  // This is used for objects (contexts in derby's case) that have a .item
  // property which refers to an array index.
  addItemContext(segments, context) {
    this.at(segments)._addItemContext(context);
  }
  
  removeBinding(binding) {
    if (!binding.eventModels) return;
    for (const id in binding.eventModels) {
      const eventModel = binding.eventModels[id];
      if (eventModel.bindings) delete eventModel.bindings[binding.id];
    }
    binding.eventModels = null;
  }
  
  _each(segments, pos, fn) {
    // Our refChildren are effectively merged into this object.
    if (this.refChildren) {
      for (const id in this.refChildren) {
        const refChild = this.refChildren[id];
        if (refChild) refChild._each(segments, pos, fn);
      }
    }
  
    if (segments.length === pos) {
      fn(this);
      return;
    }
  
    const segment = segments[pos];
    let child;
    if (typeof segment === 'string') {
      // Object. Just recurse into our objects set. Its possible to rewrite this
      // function to simply loop in the case of object lookups, but I don't think
      // it'll buy us much.
      child = this.object && this.object[segment];
      if (child) child._each(segments, pos + 1, fn);
  
    } else {
      // Number. Recurse both into the fixed list and the reference list.
      child = this.array && this.array[segment];
      if (child) child._each(segments, pos + 1, fn);
  
      child = this.arrayByReference && this.arrayByReference[segment];
      if (child) child._each(segments, pos + 1, fn);
    }
  }
  
  // Called when the scalar value at the path changes. This only calls update()
  // on this node. See update() below if you want to update entire
  // subtrees.
  localUpdate(previous, pass) {
    if (this.bindings) {
      for (const id in this.bindings) {
        const binding = this.bindings[id];
        if (binding) binding.update(previous, pass);
      }
    }
  
    // If our value changed, we also need to update anything that depends on it
    // via refOut.
    if (this.refOut) {
      for (const id in this.refOut) {
        const ref = this.refOut[id];
        if (ref) ref.update();
      }
    }
  }
  
  // This is used when an object subtree is replaced / removed.
  update(previous, pass) {
    this.localUpdate(previous, pass);
  
    if (this.object) {
      for (const key in this.object) {
        const binding = this.object[key];
        if (binding) binding.update();
      }
    }
  
    if (this.array) {
      for (let i = 0; i < this.array.length; i++) {
        const binding = this.array[i];
        if (binding) binding.update();
      }
    }
  
    if (this.arrayByReference) {
      for (let i = 0; i < this.arrayByReference.length; i++) {
        const binding = this.arrayByReference[i];
        if (binding) binding.update();
      }
    }
  }
  
  // Updates the indexes in itemContexts of our children in the range of
  // [from, to). from and to both optional.
  _updateChildItemContexts(from, to?) {
    if (!this.arrayByReference) return;
  
    if (from == null) from = 0;
    if (to == null) to = this.arrayByReference.length;
  
    for (let i = from; i < to; i++) {
      const contexts = this.arrayByReference[i] &&
        this.arrayByReference[i].itemContexts;
      if (contexts) {
        for (const key in contexts) {
          contexts[key].item = i;
        }
      }
    }
  }
  
  // Updates our array-by-value values. They have to recursively update every
  // binding in their children. Sad.
  _updateArray(from, to?) {
    if (!this.array) return;
  
    if (from == null) from = 0;
    if (to == null) to = this.array.length;
  
    for (let i = from; i < to; i++) {
      const binding = this.array[i];
      if (binding) binding.update();
    }
  }
  
  _updateObject() {
    if (this.object) {
      for (const key in this.object) {
        const binding = this.object[key];
        if (binding) binding.update();
      }
    }
  }
  
  _set(previous, pass) {
    // This just updates anything thats bound to the whole subtree. An alternate
    // implementation could be passed in the new value at this node (which we
    // cache), then compare with the old version and only update parts of the
    // subtree which are relevant. I don't know if thats an important
    // optimization - it really depends on your use case.
    this.update(previous, pass);
  }
  
  // Insert into this EventModel node.
  _insert(index, howMany) {
    // Update fixed paths
    this._updateArray(index);
  
    // Update relative paths
    if (this.arrayByReference && this.arrayByReference.length > index) {
      // Shift the actual items in the array references array.
  
      // This probably isn't the best way to implement insert. Other options are
      // using concat() on slices or though constructing a temporary array and
      // using splice.call. Hopefully if this method is slow it'll come up during
      // profiling.
      for (let i = 0; i < howMany; i++) {
        this.arrayByReference.splice(index, 0, null);
      }
  
      // Update the path in the contexts
      this._updateChildItemContexts(index + howMany);
    }
  
    // Finally call our bindings.
    if (this.bindings) {
      for (const id in this.bindings) {
        const binding = this.bindings[id];
        if (binding) binding.insert(index, howMany);
      }
    }
    this._updateObject();
  }
  
  // Remove howMany child elements from this EventModel at index.
  _remove(index, howMany) {
    // Update fixed paths. Both the removed items and items after it may have changed.
    this._updateArray(index);
  
    if (this.arrayByReference) {
      // Update relative paths. First throw away all the children which have been removed.
      this.arrayByReference.splice(index, howMany);
  
      this._updateChildItemContexts(index);
    }
  
    // Call bindings.
    if (this.bindings) {
      for (const id in this.bindings) {
        const binding = this.bindings[id];
        if (binding) binding.remove(index, howMany);
      }
    }
    this._updateObject();
  }
  
  // Move howMany items from `from` to `to`.
  _move(from, to, howMany) {
    // first points to the first element that was moved. end points to the list
    // element past the end of the changed region.
    let first, end;
    if (from < to) {
      first = from;
      end = to + howMany;
    } else {
      first = to;
      end = from + howMany;
    }
  
    // Update fixed paths.
    this._updateArray(first, end);
  
    // Update relative paths
    const arr = this.arrayByReference;
    if (arr && arr.length > first) {
      // Remove from the old location
      const values = arr.splice(from, howMany);
  
      // Insert at the new location
      // eslint-disable-next-line prefer-spread
      arr.splice.apply(arr, [to, 0].concat(values));
  
      // Update the path in the contexts
      this._updateChildItemContexts(first, end);
    }
  
    // Finally call our bindings.
    if (this.bindings) {
      for (const id in this.bindings) {
        const binding = this.bindings[id];
        if (binding) binding.move(from, to, howMany);
      }
    }
    this._updateObject();
  }
  
  // Helpers.
  mutate(segments, fn) {
    // This finds & returns a list of all event models which exist and could match
    // the specified path. The path cannot contain contexts like derby expression
    // segment lists (just because I don't think thats a useful feature and its not
    // implemented)
    this._each(segments, 0, fn);
  
    // Also emit all mutations as sets on star paths, which are how dependencies
    // for view helper functions are represented. They should react to a path
    // or any child path being modified
    for (let i = 0, len = segments.length; i++ < len;) {
      const wildcardSegments = segments.slice(0, i);
      wildcardSegments.push('*');
      this._each(wildcardSegments, 0, childSetWildcard);
    }
  }
  
  set(segments, previous, pass) {
    this.mutate(segments, function childSet(child) {
      child._set(previous, pass);
    });
  }
  
  insert(segments, index, howMany) {
    this.mutate(segments, function childInsert(child) {
      child._insert(index, howMany);
    });
  }
  
  remove(segments, index, howMany) {
    this.mutate(segments, function childRemove(child) {
      child._remove(index, howMany);
    });
  }
  
  move(segments, from, to, howMany) {
    this.mutate(segments, function childMove(child) {
      child._move(from, to, howMany);
    });
  }
}
