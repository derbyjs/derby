---
layout: default
title: Mutators
parent: Models
---

# Setters

Models allow getting and setting to nested undefined paths. Setting such a path first sets each undefined or null parent to an empty object or empty array. Whether or not a path segment is a number determines whether the implied parent is created as an object or array.

```js
model.set('cars.DeLorean.DMC12.color', 'silver');
// Logs: { cars: { DeLorean: { DMC12: { color: 'silver' }}}}
console.log(model.get());
```

All model mutators modify data and emit events synchronously. This is only safe to do, because all remote data is synchronized with Operational Transformation, and every client will eventually see a consistent view of the same data. With a more naive approach to syncing data to the server and other clients, updates to the data would need to wait until they were confirmed successful from the server.

As well as a synchronous interface, model mutators have an optional callback with an error argument `callback(err)`. This callback is called when the operation is confirmed from the server, which may be desired to confirm that data was saved before updating the UI in some rare cases. This callback should be used very rarely in practice, and data updates should be treated as sychronous, so that the UI responds immediately even if a user has a high latency connection or is currently disconnected.

## General methods

> `previous = model.set(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to assign
> * `previous` Returns the value that was set at the path previously
> * `callback` *(optional)* Invoked upon completion of a successful or failed operation

> `obj = model.del(path, [callback])`
> * `path` Model path of object to delete
> * `obj` Returns the deleted object

> `obj = model.setNull(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to assign only if the path is null or undefined
> * `obj` Returns the object at the path if it is not null or undefined. Otherwise, returns the new value

> `previous = model.setDiff(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to be set if not strictly equal to the current value
> * `previous` Returns the value that was set at the path previously

> `model.setDiffDeep(path, value, [callback])`
> `model.setArrayDiff(path, value, [callback])`
> `model.setArrayDiffDeep(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to be set if different. Deep methods will do a deep traversal and deep equality check. Array methods should be used when diffing two different arrays and only inserts, removes, and moves at the top level are desired. `setDiffDeep` can diff arrays as well but may produce a set on a particular property within an array. These methods may end up performing zero or many mutations.

## Object methods

> `id = model.add(path, object, [callback])`
> * `path` Model path to set
> * `object` A document to add. If the document has an `id` property, it will be set at that value underneath the path. Otherwise, an id from `model.id()` will be set on the object first
> * `id` Returns `object.id`

> `model.setEach(path, object, [callback])`
> * `path` Model path underneath which each property will be set
> * `object` An object whose properties are each set individually

## Number methods

> `number = model.increment(path, [byNumber], [callback])`
> * `path` Model path to set
> * `byNumber` *(optional)* Number specifying amount to increment or decrement if negative. Defaults to 1
> * `number` Returns the new value that was set after incrementing

## Array methods

Array methods can only be used on paths set to arrays, null, or undefined. If the path is null or undefined, the path will first be set to an empty array before applying the method.

> `length = model.push(path, value, [callback])`
> * `path` Model path to an array
> * `value` An item to add to the *end* of the array
> * `length` Returns the length of the array with the new item added

> `length = model.unshift(path, value, [callback])`
> * `path` Model path to an array
> * `value` An item to add to the *beginning* of the array
> * `length` Returns the length of the array with the new item added

> `length = model.insert(path, index, values, [callback])`
> * `path` Model path to an array
> * `index` Index at which to start inserting. This can also be specified by appending it to the path instead of as a separate argument
> * `values` An array of items to insert at the index
> * `length` Returns the length of the array with the new items added

> `item = model.pop(path, [callback])`
> * `path` Model path to an array
> * `item` Removes the last item in the array and returns it

> `item = model.shift(path, [callback])`
> * `path` Model path to an array
> * `item` Removes the first item in the array and returns it

> `removed = model.remove(path, index, [howMany], [callback])`
> * `path` Model path to an array
> * `index` Index at which to start removing items
> * `howMany` *(optional)* Number of items to remove. Defaults to 1
> * `removed` Returns an array of removed items

> `moved = model.move(path, from, to, [howMany], [callback])`
> * `path` Model path to an array
> * `from` Starting index of the item to move
> * `to` New index where the item should be moved
> * `howMany` *(optional)* Number of items to move. Defaults to 1
> * `moved` Returns an arry of items that were moved

## String methods

String methods can only be used on paths set to strings, null, or undefined. If the path is null or undefined, the path will first be set to an empty string before applying the method.

The string methods support collaborative text editing, and Derby uses string methods to bind changes to all text inputs and textareas by default.

> `model.stringInsert(path, index, text, [callback])`
> * `path` Model path to a string
> * `index` Character index within the string at which to insert
> * `text` String to insert

> `model.stringRemove(path, index, howMany, [callback])`
> * `path` Model path to a string
> * `index` Starting character index of the string at which to remove
> * `howMany` Number of characters to remove
