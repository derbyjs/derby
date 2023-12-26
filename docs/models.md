---
layout: default
title: Models
has_children: true
---

# Models

DerbyJS models are provided by [Racer](https://github.com/derbyjs/racer), a realtime model synchronization engine. By building on ShareDB, Racer enables multiple users and services to interact with the same data objects with realtime conflict resolution. Racer models have a simple getter/setter and event interface for writing application logic.

## Racer and ShareDB

Racer provides a single interface for working with local data stored in memory and remote data synced via ShareDB. It works equally well on the server and the browser, and it is designed to be used independently from DerbyJS. This is useful when writing migrations, data-only services, or integrating with different view libraries.

Remotely synced data is stored via [ShareDB](https://github.com/share/sharedb), which means that different clients can modify the same data at the same time. ShareDB uses [Operational Transformation (OT)](https://en.wikipedia.org/wiki/Operational_transformation) to automatically resolve conflicts in realtime or offline.

On the server, Racer provides a `store`, which configures a connection to a database and pub/sub adapter. Every store connected to the same database and pub/sub system is synchronized in realtime.

Stores create `model` objects. Models have a synchronous interface similar to interacting directly with objects. They maintain their own copy of a subset of the global state. This subset is defined via [subscriptions](backends#loading-data-into-a-model) to certain queries or documents. Models perform operations independently, and they automatically synchronize their state.

Models emit events when their contents are updated, which DerbyJS uses to update the view in realtime.

## Creating models

Derby provides a model when calling application routes. On the server, it creates an empty model from the `store` associated with an app. When the server renders the page, the model is serialized. It is then reinitialized into the same state on the client. This model object is passed to app routes rendered on the client.

Derby uses the model supplied by the store.modelMiddleware by calling `req.getModel()`. To pass data from server-side express middleware or routes, the model can be retrieved via this same method and data can be set on it before passing control to the app router.

If you would like to get or set data outside of the app on the server, you can create models directly via `store.createModel()`.

> `model = store.createModel(options)`
> * `options:`
>   * `fetchOnly` Set to true to make model.subscribe calls perform a fetch instead
> * `model` Returns a model instance associated with the given store

## Store

Typically, a project will have only one store, even if it has multiple apps. It is possible to have multiple stores, but a model can be associated with only a single store, and a page can have only a single model.

> `store = derby.createStore(options)`
> * `options` See the [Backends](backends) section for information on configuration
> * `store` Returns a Racer store instance

### Methods

> `middleware = store.modelMiddleware()`
> * `middleware` Returns a connect middleware function

The model middleware adds a `req.getModel()` function which can be called to create or get a model (if one was already created) for a given request. It also closes this model automatically at the end of the request.

Model's created from `req.getModel()` specify the option `{fetchOnly: true}`. This means that calls to `model.subscribe()` actually only fetch data and don't subscribe. This is more efficient during server-side rendering, since the model is only created for long enough to handle the route and render the page. The model then gets subscribed when it initializes in the browser.

```js
var expressApp = express();
expressApp.use(store.modelMiddleware());

expressApp.get('/', function(req, res, next) {
  var model = req.getModel();
});
```
