---
layout: default
title: Data loading contexts
parent: Backends and data loading
grand_parent: Models
---

# Data loading contexts

As data is loaded into a model with calls to fetch and subscribe, Racer tracks the number of fetches and subscribes per document path and query. Data is not removed from a model until it is released by calling unfetch and unsubscribe the matching number of times for each document or query. For example, after calling `subscribe()` on a query twice, then `unsubscribe()` once, the query would remain subscribed. It would be unsubscribed and its data would be removed from the model only after `unsubscribe()` was called once more.

This behavior is helpful, since multiple parts of an application may need the same resource, but they may want perform data loading and unloading independently. For example, an edit dialog may be opened and closed while some of the same data may be displayed in a list; or a migration script may fetch data in batches in order to process a large amount of data without loading all of it into memory simultaneously.

Contexts provide a way to track a group of related fetches and subscribes. In addition, they provide an `unload()` method that unfetches and unsubscribes the corresponding number of times. By default, all fetches and subscribes happen within the `'root'` context. Additional context names may be used to isolate the loading and unloading of data within the same model for independent purposes.

> `childModel = model.context(name)`
> * `name` A string uniquely identifying a context. Calling `model.context()` again with the same string will refer to the same context. By default, models have the context name `'root'`
> * `childModel` Returns a model with a context of `name`, overriding the parent model's context name. All fetch, subscribe, and unload actions performed on this childModel will have this context

> `model.unload([name])`
> * `name` *(optional)* Unfetch and unsubscribe from all documents and queries for the corresponding number of times they were fetched and subscribed. This will end subscriptions and remove the data from the model if no remaining fetches or subscribes hold the data in the model under a different context. Defaults to the current model context name. Specifying a `name` argument overrides the default

> `model.unloadAll()`
> * Unload each context within a model. Results in all remotely loaded data being removed from a model. (Data within [local collections](paths#local-and-remote-collections) will remain.)

## Usage example

```js
function openTodos(model) {
  // Create a model with a load context inheriting from the current model
  var dialogModel = model.context('todosDialog');
  // Load data
  var userId = dialogModel.scope('_session.userId').get();
  var user = dialogModel.scope('users.' + userId);
  var todosQuery = dialogModel.query('todos', {creatorId: userId});
  dialogModel.subscribe(user, todosQuery, function(err) {
    if (err) throw err;
    // Delay display until required data is loaded
    dialogModel.set('showTodos', true);
  });
}

function closeTodos(model) {
  model.set('showTodos', false);
  // Use the same context name to unsubscribe
  model.unload('todosDialog');
}
```

## Automatic unloading on page navigation

Derby uses Racer model contexts to unload the data for the previous page render when it performs client-side routing and a full-page render. When moving away from a page and before calling into the route for the new page, Derby calls `unloadAll()`, removing the data from all subscribes and fetches performed on the prior page.
