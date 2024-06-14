---
layout: default
title: Paths
parent: Models
---

# Paths

The model's data can be thought of as a JSON object tree.

A path is a string with dot-separated segments, referring to a node (sub-object or value) within the tree. Each segment represents a property lookup within an object or array. Array indexes are 0-based like in JavaScript.

For example, the model data:

```js
{
  _page: {
    currentStorefrontId: 'storefront-1',
  },
  storefronts: {
    'storefront-a': {
      id: 'storefront-a',
      title: 'Fruit store',
      fruits: [
        { name: 'banana', color: 'yellow' },
        { name: 'apple', color: 'red' },
        { name: 'lime', color: 'green' }
      ]
    }
  }
}
```

Would have paths like:
- `'_page'`, referring to the object `{ currentStorefrontId: 'storefront-1' }`
- `'storefronts.storefront-a.title'`, referring to the title of "storefront-a"
- `'storefronts.storefront-a.fruits.0'`, referring to the first fruit object in "storefront-a"

From the data root, the first level of properties are collection names, in this case `'_page'` and `'storefront-a'`. These can have special meanings, as described in the next section.

> **WARNING** If you want to use a number as a path segment, be careful to prefix this before setting it. Otherwise, you will accidentally create a gigantic array and probably run out of memory. For example, use a path like: `items.id_1239182389123.name` and never `items.1239182389123.name`.

## Local and remote collections

Collection names (i.e. the first path segment) that start with an underscore (`_`) are local and are not synced to the database. Data written to local collections during server-side rendering _is_ available in the browser, but that data isn't shared with other servers or clients.

Collection names that begin with dollar signs (`$`) are special local collections reserved for use by Racer, Derby, or extensions, and should not be used for application data.

Collection names not prefixed with those special characters are considered remote collections, and will be synced to the server and other clients via ShareDB.

Almost all non-synced data within an application should be stored underneath the `_page` local collection, which Derby to automatically cleans up when the user navigates between pages. Right before rendering a new page, Derby calls `model.destroy('_page')`, which removes all data, references, event listeners, and reactive functions underneath the `_page` collection.

If you have some local data that you would like to be maintained between page renders, it can be stored underneath a different local collection. This is useful for setting data on the server, such as setting `_session.userId` in authentication code. However, be very careful when storing local data outside of `_page`, since bleeding state between pages is likely to be a source of unexpected bugs.

## Scoped models

Scoped models provide a more convenient way to interact with commonly used paths. They support the same methods, and they provide the path argument to accessors, mutators, event methods, and subscription methods. Also, wherever a path is accepted in a racer method, a scoped model can typically be used as well.

> `scoped = model.at(subpath)`
> * `subpath` A relative path starting from the current model's path
> * `scoped` Returns a scoped model

> `scoped = model.scope([absolutePath])`
> * `absolutePath` *(optional)* An absolute path from the root of the model data, or the root path by default. This will become the scope even if called on a scoped model. May be called without a path to get a model scoped to the root
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
const roomModel = model.at('_page.room');

// These are equivalent:
roomModel.at('name').set('Fun room');
roomModel.set('name', 'Fun room');

// Logs: {name: 'Fun room'}
console.log(roomModel.get());
// Logs: 'Fun room'
console.log(roomModel.get('name'));

// Use model.scope(absolutePath) to refer to things outside a model's subtree.
class MyComponent extends Component {
  init() {
    // In a component, `this.model` is the component's "private" scoped model
    const roomModel = this.model.scope('_page.room');
  }
}
```

## UUIDs

Models provide a method to create globally unique ids. These can be used as part of a path or within mutator methods.

> `uuid = model.id()`
> * `uuid` Returns a globally unique identifier that can be used for model operations
