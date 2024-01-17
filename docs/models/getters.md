---
layout: default
title: Getters
parent: Models
---

# Getters

Data in the model is accessed with `model.get()`. This method returns values by reference, based on the model's scope and/or the path passed to the get method. Models allow getting undefined paths. The get method will return `undefined` and will not throw when looking up a property below another property that is undefined.

Internally, model data is represented as collections of documents. Collections must be objects, and documents may be of any type, but are also typically objects. A document's data at a point in time is referred to as its snapshot. This structure allows for some documents to be remote documents synced with the server and some to be local documents only in the client. It also means that models are broken into a similar structure as database collections or tables.

As model document snapshots change from local or remote mutations, the `model.root.data` object is updated. `model.get()` traverses through the properties of the model's data to lookup and return the appropriate value.

```js
model.get('_session.account') === model.root.data._session.account;
```

> `value = model.get([path])`
> * `path` *(optional)* Path of object to get. Not supplying a path will return all data in the model starting from the current scope
> * `value` Current value of the object at the given path. Note that objects are returned by reference and should not be modified directly

> `shallowCopy = model.getCopy([path])`
> * `path` *(optional)* Path of object to get
> * `shallowCopy` Shallow copy of current value, going only one level deep when returning an object or array

> `deepCopy = model.getDeepCopy([path])`
> * `path` *(optional)* Path of object to get
> * `deepCopy` Deep copy of current value

## Values returned by reference

`model.get()` returns values by reference. Racer will fail to function correctly if data in the model is manipulated directly instead of via its mutator methods, such as `model.set()`. You should *never* mutate objects returned from `model.get()` directly.

As a convenience, Racer also provides a `model.getCopy()` method that returns a shallow copy and `model.getDeepCopy()` method that returns a deep copy. It is safe to mutate copied objects. Changes in these objects can then be updated back into the model using `model.setDiffDeep()`.

```js
// WARNING: Do NOT directly manipulate objects in the model
var user = model.get('users.' + userId);
user.name = 'John';

// Instead, use the model setter methods
var user = model.get('users.' + userId);
model.set('users.' + userId + '.name', 'John');

// Or, get a copy and set the difference
var user = model.getDeepCopy('users.' + userId);
user.name = 'John';
model.setDiffDeep('users.' + userId, user);
```
