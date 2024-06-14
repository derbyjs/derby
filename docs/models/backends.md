---
layout: default
title: Backends and data loading
parent: Models
has_children: true
---

# Backends

Racer stores are backed by ShareDB, which is used to persist data, perform queries, keep a journal of all operations, and pub/sub operations and changes to queries. Currently, ShareDB has [two pub/sub adapters](https://share.github.io/sharedb/adapters/pub-sub): one for in memory and one for Redis based pub/sub. ShareDB supports in memory or MongoDB storage. The database adapter [ShareDBMongo](https://github.com/share/sharedb-mongo)
is backed by a real Mongo database and full query support. ShareDB is written with support for additional database adapters in mind.

Getting started with a single-process server and MongoDB:

```js
var derby = require('derby');
var ShareDbMongo = require('sharedb-mongo');

var db = new ShareDbMongo('mongodb://localhost:27017/test');
var backend = derby.createBackend({db: db});
var model = backend.createModel();
```

The above examples use the in-process driver by default. In a production environment, you'll want to scale across multiple frontend servers and support updating data in other processes, such as migration scripts and additional services. For this, you should use the [ShareDB Redis pub/sub adapter](https://github.com/share/sharedb-redis-pubsub). ShareDB requires Redis 2.6 or newer, since it uses Lua scripting commands.

```js
var derby = require('derby');
var ShareDbMongo = require('sharedb-mongo');
var RedisPubSub = require('sharedb-redis-pubsub');

var db = new ShareDbMongo('mongodb://localhost:27017/test');
var backend = derby.createBackend({
  db: db,
  pubsub: new RedisPubSub()
});
var model = backend.createModel();
```

See [ShareDBMongo](https://github.com/share/sharedb-mongo) and [ShareDB Redis](https://github.com/share/sharedb-redis-pubsub) documentation for more information on configuration options.

The Redis driver supports flushing all data from Redis or starting with an empty Redis database with journal and snapshot data in MongoDB. Thus, it is OK to start with a basic deployment using only a single process and add Redis later or to flush the Redis database if it becomes corrupt.

## Mapping between database and model

Racer paths are translated into database collections and documents using a natural mapping:

```bash
collection.documentId.documentProperty
```

ShareDB Mongo will add the following properties to Mongo documents for internal use:
* `_m.ctime` - Timestamp when the ShareDB document was created
* `_m.mtime` - Timestamp when the ShareDB document was last modified
* `_type` - [OT type](https://share.github.io/sharedb/types/)
* `_v` - [Snapshot version](https://share.github.io/sharedb/api/snapshot)

In addition to `ctime` and `mtime`, custom metadata properties can be added to `_m` with middleware that modifies `snapshot.m` in apply or commit.

Since these underscore-prefixed properties are for ShareDB's internal use, ShareDB Mongo will strip out these properties (`_m`, `_type`, and `_v`) as well as `_id` when it returns the document from Mongo. The `_id` is removed because Racer adds an `id` alias to all local documents. This alias references the `_id` property of the original Mongo document.

If a document is an object, it will be stored as the Mongo document directly. For example,

```js
{
  make: "Ford",
  model: "Mustang",
  year: 1969,
  _m: {
    ctime: 1494381632731,
    mtime: 1494381635994
  },
  _type: "http://sharejs.org/types/JSONv0",
  _v: 12
}
```

If it is another type (e.g. [Plaintext OT Type](https://github.com/ottypes/text)), the value will be nested under a property on the Mongo document called `_data`.

```js
{
  _data: "This is a text message.",
  _m: {
    ctime: 1494381632731,
    mtime: 1494381635994
  },
  _type: "http://sharejs.org/types/text",
  _v: 12
}
```

It is not possible to set or delete an entire collection, or get the list of collections via the Racer API.

## Loading data into a model

The `subscribe`, `fetch`, `unsubscribe`, and `unfetch` methods are used to load and unload data from the database. These methods don't return data directly. Rather, they load the data into a model. Once loaded, the data are then accessed via model getter methods.

`subscribe` and `fetch` both load the requested data into the model. Subscribe also registers with pub/sub, automatically applying remote updates to the locally loaded data.

> `model.subscribe(items, callback)`
> `model.fetch(items, callback)`
> `model.unsubscribe(items, callback)`
> `model.unfetch(items, callback)`
> * `items` - `string | ChildModel | Query | Array<string | ChildModel | Query>` - Specifier(s) for one or more loadable items, such as a document path, scoped model, or query
> * `callback` - `(error?: Error) => void` - Calls back once all of the data for each item has been loaded or when an error is encountered

There are also promise-based versions of the methods, available since racer@1.1.0.

> `model.subscribePromised(items)`
> `model.fetchPromised(items)`
> `model.unsubscribePromised(items)`
> `model.unfetchPromised(items)`
> * These each return a `Promise<void>` that is resolved when the requested item(s) are loaded or rejected on errors.

Avoid subscribing or fetching queries by document id like `model.query('users', {_id: xxx})`. You can achieve the same result passing `'users.xxx'` or `model.at('users.xxx')` to subscribe or fetch, and it is much more efficient.

If you only have one argument in your call to subscribe or fetch, you can also call `subscribe`, `fetch`, `unsubscribe`, and `unfetch` on the query or scoped model directly.

```js
// Subscribing to a single document with a path string.
const userPath = `users.${userId}`;
model.subscribe(userPath, (error) => {
  if (err) return next(err);
  console.log(model.get(userPath));
});
// Subscribing to two things at once: a document via child model and a query.
const userModel = model.at(userPath);
const todosQuery = model.query('todos', {creatorId: userId});
model.subscribe([userModel, todosQuery], function(err) {
  if (err) return next(err);
  console.log(userModel.get(), todosQuery.get());
});

// Promise-based API
model.subscribePromised(userPath).then(
  () => {
    console.log(model.get(userPath));
  },
  (error) => { next(error); }
);
// Promise-based API with async/await
try {
  await model.subscribePromised([userModel, todosQuery]);
  console.log(userModel.get(), todosQuery.get());
} catch (error) {
  // Handle subscribe error
}
```

Racer internally keeps track of the context in which you call subscribe or fetch, and it counts the number of times that each item is subscribed or fetched. To actually unload a document from the model, you must call the unsubscribe method the same number of times that subscribe is called and the unfetch method the same number of times that fetch is called.

However, you generally don't need to worry about calling unsubscribe and unfetch manually. Instead, the `model.unload()` method can be called to unsubscribe and unfetch from all of the subscribes and fetches performed since the last call to unload.

Derby unloads all contexts when doing a full page render, right before invoking route handlers. By default, the actual unsubscribe and unfetch happens after a short delay, so if something gets resubscribed during routing, the item will never end up getting unsubscribed and it will callback immediately.

See the [Contexts documentation](contexts) for more details.
