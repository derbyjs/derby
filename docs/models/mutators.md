---
layout: default
title: Mutators
parent: Models
---

# Mutators

Mutator methods synchronously update data in the local model, then for remote (DB-backed) collections, they  will also send the operation to the server. If there's an error committing the op, the local model will roll back the mutation so that the local model reflects the database state.

Models allow getting and setting to nested undefined paths. Setting such a path first sets each undefined or null parent to an empty object or empty array. Whether or not a path segment is a number determines whether the implied parent is created as an object or array.

```js
model.set('cars.DeLorean.DMC12.color', 'silver');
// Logs: { cars: { DeLorean: { DMC12: { color: 'silver' }}}}
console.log(model.get());
```

## Error handling

In frontend Derby apps, it's usually fine to use the mutator methods synchronously, since ShareDB's operational transform logic allows the local model to optimisically reflect the update before it's committed to the database.

Unhandled mutation errors are emitted as `'error'` events on the root model. For frontend code, these can be handled at the top level like this:

```js
// The 'ready' event is only emitted in the browser.
app.on('ready', () => {
  app.model.on('error', (error) => {
    // Handle the error appropriately, such as displaying an error message
    // to the user and asking them to refresh.
    displayErrorMessage();
    // Report the error to your error-handling tool manually, or
    // just re-throw for reporting.
    throw error;
  });
});
```

To handle errors in individual mutation calls via callbacks or promises, see the [Confirming mutations](#confirming-mutations) section below.

## General methods

> `previous = model.set(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to assign
> * `previous` Returns the value that was set at the path previously

> `obj = model.del(path, [callback])`
> * `path` Model path of value to delete
> * `obj` Returns the deleted value

> `obj = model.setNull(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to assign only if the current value is null or undefined
> * `obj` Returns the object at the path if it is not null or undefined. Otherwise, returns the new value

> `previous = model.setDiff(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to be set only if the current value is not strictly equal (`===`) to the current value
> * `previous` Returns the value that was set at the path previously

> `model.setDiffDeep(path, value, [callback])`
> `model.setArrayDiff(path, value, [callback])`
> `model.setArrayDiffDeep(path, value, [callback])`
> * `path` Model path to set
> * `value` Value to be set if different. Deep methods will do a deep traversal and deep equality check. Array methods should be used when diffing two different arrays and only inserts, removes, and moves at the top level are desired. `setDiffDeep` can diff arrays as well but may produce a set on a particular property within an array. These methods may end up performing zero or many mutations.

## Object methods

> `id = model.add(collectionName, object, [callback])`
> * `collectionName` Name of the collection to add an object to
> * `object` A document to add. If the document has an `id` property, it will be used as the new object's key in the collection. Otherwise, an UUID from `model.id()` will be set on the object first
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

## Confirming mutations

In backend code or certain kinds of frontend code, it's often necessary to know when the mutation is actually committed, and handling errors from specific mutations can be useful. There are a couple ways of doing so:

- **Callback function**
  - All mutator methods take a final optional `callback` parameter, `(error?: Error) => void`.
  - The callback is called with no error when the mutation is successfully commited to the database, and it's called with an error if the mutation failed to commit.
- **Promise API** _(since racer@1.1.0)_
  - Each mutator method has a promise-based version `___Promised()`. For example, `set(path, value)` has `setPromised(path, value)`.
  - The promise is resolved when the mutation is successfully commited to the database, and it's rejected with an error if the mutation failed to commit.
  - Most mutator promises are `Promise<void>`, resolving with no value. The one exception is `addPromised`, which resolves with the string `id` of the new document.

Even when using these, the mutation is still synchronously applied to the local model, so that the UI responds immediately even if a user has a high latency connection or is currently disconnected.

```js
// Callback API
model.set('note-1.title', 'Hello world', (error) => {
  if (error) {
    return handleError(error);
  }
  console.log('Update successful!');
});
// Promise API
try {
  await model.setPromised('note-1.title', 'Hello world');
} catch (error) {
  return handleError(error);
}
console.log('Update successful!');
```

### `whenNothingPending()`

In rare situations, such as backend batch-update code, you might be makes many synchronous-style mutations without callbacks/promises, and you want to know when ALL pending mutations, fetches, and subscribes on a model are finished.

`whenNothingPending()` can do that, but keep in mind these warnings:
* It can end up waiting on unrelated operations issued by other code using the same model, so only use it if you're sure the model isn't actively being used elsewhere.
* Performance can be bad if there are tons of documents and queries in the model.
* You do _not_ need to call this prior to `model.close()`, since that already waits internally for pending requests to finish.

> `model.whenNothingPending(callback)`
> * `callback` - `() => void` - Optional callback, called when the model has no more pending mutations, fetches, or subscribes.

> `nothingPendingPromise = model.whenNothingPendingPromised()`
> * Returns a `Promise<void>` that resolves when the model has no more pending mutations, fetches, or subscribes. The promise will never be rejected.
