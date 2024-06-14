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

## Basic get methods

The basic `get` methods are fastest for most use-cases, where you don't need to do directly manipulate returned objects/arrays.

> `value = model.get([subpath])`
> * `path` *(optional)* Subpath of object to get. Not supplying a subpath will return the entire value at the current model's path.
> * `value` Returns the current value at the given subpath.

> `value = model.getOrThrow(subpath)` _(since racer@2.1.0)_
> * `path` Subpath of object to get
> * `value` Returns the current value at the given subpath, if not null-ish. If the current value is `null` or `undefined`, an exception will be thrown.

> `value = model.getOrDefault(subpath, defaultValue)` _(since racer@2.1.0)_
> * `path` *(optional)* Subpath of object to get
> * `value` Returns the current value at the given subpath, if not null-ish. If the current value is `null` or `undefined`, the provided `defaultValue` will be returned instead.
>
> This method will _not_ put the default into the model. It's equivalent to using the relatively newer [JS nullish coalescing operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing) as `model.get(subpath) ?? defaultValue`.

{: .warning-red }
> When using the non-copying `get` methods above to get an object or array, do NOT modify or sort the returned value in-place.
>
> The returned values are references to Racer's internal data tree, and direct manipulations can cause hard-to-debug issues. To make changes to model data, use [the mutator methods](mutators).
>
> If you do need to modify the value in-place, such as for sorting or for a later `setDiffDeep`, use the copying getters below.
>
> The TypeScript types indicate this restriction by returning a `ReadonlyDeep` version of the type parameter.

## Copying get methods

> `shallowCopy = model.getCopy([path])`
> * `path` *(optional)* Path of object to get
> * `shallowCopy` Shallow copy of current value, going only one level deep when returning an object or array

> `deepCopy = model.getDeepCopy([path])`
> * `path` *(optional)* Path of object to get
> * `deepCopy` Deep copy of current value

```js
// Do NOT directly manipulate objects in the model
var user = model.get('users.' + userId);
/* BAD */ user.name = 'John'; /* BAD */

// Instead, use the model setter methods
var user = model.get('users.' + userId);
model.set('users.' + userId + '.name', 'John');

// Or, get a copy and set the difference
var user = model.getDeepCopy('users.' + userId);
user.name = 'John';
model.setDiffDeep('users.' + userId, user);
```
