---
layout: default
title: Paths
parent: Models
---

# Paths

All model operations happen on paths which represent nested JSON objects. These paths must be globally unique within a particular database and Redis journal.

For example, the model data:

```js
{
  title: 'Fruit store',
  fruits: [
    { name: 'banana', color: 'yellow' },
    { name: 'apple', color: 'red' },
    { name: 'lime', color: 'green' }
  ]
}
```

Would have paths like `title`, `fruits.1`, and `fruits.0.color`. Any path segment that is a number must be an index of an array.

> **WARNING** If you want to use an id value that is a number as a path segment, be careful to prefix this with another character, such as `_` before setting it. Otherwise, you will accidentally create a gigantic array and probably run out of memory. For example, use a path like: `items._1239182389123.name` and never `items.1239182389123.name`.

## Local and remote collections

Collection names (i.e. the first path segment) that start with an underscore (`_`) or dollar sign (`$`) are local to a given model and are not synced. All paths that start with another character are remote, and will be synced to servers and other clients via ShareJS. Collections that begin with dollar signs are reserved for use by Racer, Derby, or extensions, and should not be used for application data.

Almost all non-synced data within an application should be stored underneath the `_page` local collection. This enables Derby to automatically cleanup as the user navigates between pages. Right before rendering a new page, Derby calls `model.destroy('_page')`, which removes all data, references, event listeners, and reactive functions underneath the `_page` collection. If you have some data that you would like to be maintained between page renders, it can be stored underneath a different local collection. This is useful for setting data on the server, such as setting `_session.userId` in authentication code. However, be very careful when storing local data outside of `_page`, since bleeding state between pages is likely to be a source of unexpected bugs.

## Scoped models

Scoped models provide a more convenient way to interact with commonly used paths. They support the same methods, and they provide the path argument to accessors, mutators, event methods, and subscription methods. Also, wherever a path is accepted in a racer method, a scoped model can typically be used as well.

> `scoped = model.at(subpath)`
> * `subpath` The relative reference path to set. The path is appended if called on a scoped model
> * `scoped` Returns a scoped model

> `scoped = model.scope([path])`
> * `path` *(optional)* The absolute reference path to set, or the root path by default. This will become the scope even if called on a scoped model. May be called without a path to get a model scoped to the root
> * `scoped` Returns a scoped model

> `scoped = model.parent([levels])`
> * `levels` *(optional)* Defaults to 1. The number of path segments to remove from the end of the reference path
> * `scoped` Returns a scoped model

> `path = model.path([subpath])`
> * `subpath` *(optional)* A relative reference path to append. Defaults to the current path
> * `path` Returns the reference path if applicable

> `isPath = model.isPath(subpath)`
> * `subpath` A relative reference path or scoped model
> * `isPath` Returns true if the argument can be interpreted as a path, false otherwise

> `segment = model.leaf()`
> * `segment` Returns the last segment for the reference path. Useful for getting indices, ids, or other properties set at the end of a path

```js
room = model.at('_page.room');

// These are equivalent:
room.at('name').set('Fun room');
room.set('name', 'Fun room');

// Logs: {name: 'Fun room'}
console.log(room.get());
// Logs: 'Fun room'
console.log(room.get('name'));
```

## GUIDs

Models provide a method to create globally unique ids. These can be used as part of a path or within mutator methods.

> `guid = model.id()`
> * `guid` Returns a globally unique identifier that can be used for model operations
