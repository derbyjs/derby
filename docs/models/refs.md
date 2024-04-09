---
layout: default
title: Refs
parent: Models
---

# References

References make it possible to write business logic and templates that interact with the model in a general way. They redirect model operations from a reference path to the underlying data, and they set up event listeners that emit model events on both the reference and the actual object's path.

References must be declared per model, since calling `model.ref` creates a number of event listeners in addition to setting a ref object in the model. When a reference is created or removed, a `change` model event is emitted. References are not actually stored in the model data, but they can be used from getter and setter methods as if they are.

> `scoped = model.ref(path, to, [options])`
> * `path` The location at which to create a reference. This must be underneath a [local collection](paths#local-and-remote-collections) (typically `_page`), since references must be declared per model
> * `to` The location that the reference links to. This is where the data is actually stored
> * `options:`
>   * `updateIndices` Set true to update the ref's `to` path if it contains array indices whose parents are modified via array inserts, removes, or moves
> * `scoped` Returns a model scoped to the output path for convenience

> `model.removeRef(path)`
> * `path` The location at which to remove the reference

```js
model.set('colors', {
  red: {hex: '#f00'}
, green: {hex: '#0f0'}
, blue: {hex: '#00f'}
});

// Getting a reference returns the referenced data
model.ref('_page.green', 'colors.green');
// Logs {hex: '#0f0'}
console.log(model.get('_page.green'));

// Setting a property of the reference path modifies
// the underlying data
model.set('_page.green.rgb', [0, 255, 0]);
// Logs {hex: '#0f0', rgb: [0, 255, 0]}
console.log(model.get('colors.green'));

// Removing the reference has no effect on the underlying data
model.removeRef('_page.green');
// Logs undefined
console.log(model.get('_page.green'));
// Logs {hex: '#0f0', rgb: [0, 255, 0]}
console.log(model.get('colors.green'));
```

Racer also supports a special reference type created via `model.refList`. This type of reference is useful when a number of objects need to be rendered or manipulated as a list even though they are stored as properties of another object. This is also the type of reference created by a query. A reference list supports the same mutator methods as an array, so it can be bound in a view template just like an array.

> `scoped = model.refList(path, collection, ids, [options])`
> * `path` The location at which to create a reference list. This must be underneath a [local collection](paths#local-and-remote-collections) (typically `_page`), since references must be declared per model
> * `collection` The path of an object that has properties to be mapped onto an array. Each property must be an object with a unique `id` property of the same value
> * `ids` A path whose value is an array of ids that map the `collection` object's properties to a given order
> * `options:`
>   * `deleteRemoved` Set true to delete objects from the `collection` path if the corresponding item is removed from the refList's output path
> * `scoped` Returns a model scoped to the output path for convenience

> `model.removeRefList(path)`
> * `path` The location at which to remove the reference

Note that if objects are inserted into a refList without an `id` property, a unique id from [`model.id()`](#guids) will be automatically added to the object.

```js
// refLists should consist of objects with an id matching
// their property on their parent
model.setEach('colors', {
  red: {hex: '#f00', id: 'red'},
  green: {hex: '#0f0', id: 'green'},
  blue: {hex: '#00f', id: 'blue'}
});
model.set('_page.colorIds', ['blue', 'red']);
model.refList('_page.myColors', 'colors', '_page.colorIds');

model.push('_page.myColors', {hex: '#ff0', id: 'yellow'});

// Logs: [
//   {hex: '#00f', id: 'blue'},
//   {hex: '#f00', id: 'red'},
//   {hex: '#ff0', id: 'yellow'}
// ]
console.log(model.get('_page.myColors'));
```

When a collection is cleaned up by `model.destroy()`, the `model.removeAllRefs()` method is invoked to remove all refs and refLists underneath the collection.

> `model.removeAllRefs(from)`
> * `from` Path underneath which to remove all refs and refLists

It isn't neccessary to manually dereference model paths, but for debugging, testing, or special cases there is a `model.dereference()` method.

> `resolved = model.dereference(from)`
> * `from` Path to dereference
> * `resolved` Returns the fully dereferenced path, possibly passing through multiple refs or refLists. Will return the input path if no references are found
