---
layout: default
title: Models
has_children: true
---

# Models

DerbyJS's models are provided by [Racer](https://github.com/derbyjs/racer), a realtime model synchronization engine built for Derby. By building on ShareDB, Racer enables multiple users and services to interact with the same data objects with realtime conflict resolution.

Racer models can also be used without Derby, such as in backend code to interact with ShareDB-based data, or even in frontend code with another UI framework.

A model's data can be thought of as a JSON object tree - see the [Paths documentation](models/paths) for details.

Racer models provide functionality useful for writing real-time application logic:
- Methods to [load data into the model](backends#loading-data-into-a-model), including via [database queries](queries)
- Null-safe [getter methods](getters) and [mutator (setter) methods](mutators)
- [Reactive functions](reactive-functions) for automatically producing output data whenever any input data changes
  - Built-in reactive [filter and sort](filters-sorts) functions
- [Data change events](events) for more complex situations not covered by pure reactive functions

## Racer and ShareDB

Racer provides a single interface for working with local data stored in memory and remote data synced via ShareDB. It works equally well on the server and the browser, and it is designed to be used independently from DerbyJS. This is useful when writing migrations, data-only services, or integrating with different view libraries.

Remotely synced data is stored via [ShareDB](https://github.com/share/sharedb), which means that different clients can modify the same data at the same time. ShareDB uses [Operational Transformation (OT)](https://en.wikipedia.org/wiki/Operational_transformation) to automatically resolve conflicts in realtime or offline.

On the server, Racer provides a `backend` that extends the [ShareDB Backend](https://share.github.io/sharedb/api/backend). It configures a connection to a database and pub/sub adapter. Every backend connected to the same database and pub/sub system is synchronized in realtime.

Backends create `model` objects. Models have a synchronous interface similar to interacting directly with objects. They maintain their own copy of a subset of the global state. This subset is defined via [subscriptions](backends#loading-data-into-a-model) to certain queries or documents. Models perform operations independently, and they automatically synchronize their state.

Models emit events when their contents are updated, which DerbyJS uses to update the view in realtime.

## Creating models

On the server, `backend.modelMiddleware()` provides an Express-compatible middleware function that, when run during request handling, creates a new empty model for the request and attaches it to `req.model`. Custom middleware can be added between the `modelMiddleware()` and the application routes to customize the model's data.

When the server runs an application route, it uses `req.model` to render the page. The model state is serialized into the server-side rendered page, and then in the browser, the model is reinitialized into the same state. This model object is passed to app routes rendered on the client.

```js
// Middleware to add req.model on each request
expressApp.use(backend.modelMiddleware());

// Subsequent middleware can use the model
expressApp.use((req, res, next) => {
  req.model.set('_session.userId', 'test-user');
  next();
});

// Derby application routes use req.model for rendering
expressApp.use(derbyApp.router());
```

If you would like to get or set data on the server outside of the context of a request, you can create models directly via `backend.createModel()`.

> `model = backend.createModel(options)`
> * `options:`
>   * `fetchOnly` Set to true to make model.subscribe calls perform a fetch instead
> * `model` Returns a model instance associated with the given backend

## Closing models

Models created by `modelMiddleware()` are automatically closed when the Express request ends.

To close a manually-created model, you can use `model.close()`. The `close()` method will wait for all pending operations to finish before closing the model.

> `backend.close([callback])`
> * `callback` - `() => void` - Optional callback, called once the model has finished closing.

> `closePromise = backend.closePromised()`
> * Returns a `Promise<void>` that resolves when the model has finished closing. The promise will never be rejected.

## Backend

Typically, a project will have only one backend, even if it has multiple apps. It is possible to have multiple backends, but a model can be associated with only a single backend, and a page can have only a single model.

> `backend = derby.createBackend(options)`
> `backend = racer.createBackend(options)`
> * `options` See the [Backends](backends) section for information on configuration
> * `backend` Returns a Racer backend instance

### Methods

> `middleware = backend.modelMiddleware()`
> * `middleware` Returns an Express-compatible middleware function

The model middleware creates a new model for each request and adds a `req.model` reference to that model. It also closes this model automatically at the end of the request.

Models created by `modelMiddleware()` use the `{fetchOnly: true}` option. That means during server-side rendering, `model.subscribe()` doesn't actually register with the pub/sub system, which is more efficient since the model is only open for the short lifetime of the request. It's still tracked as a subscription so that when the model is re-initialized in the browser, the browser can register the actual subscriptions.
