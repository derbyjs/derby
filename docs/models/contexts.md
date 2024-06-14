---
layout: default
title: Data loading contexts
parent: Backends and data loading
grand_parent: Models
---

# Data loading contexts

Data loading contexts are an advanced feature, useful for features like pop-over dialogs and modals that need to load their own data independently from the parent page.

Racer uses something like [reference counting](https://en.wikipedia.org/wiki/Reference_counting) for fetches and subscribes. As data is loaded into a model with calls to fetch and subscribe, Racer tracks the number of fetches and subscribes for each document and query. Data is not removed from a model until it is released by calling unfetch and unsubscribe the matching number of times for each document or query.

For example, after calling `subscribe()` on a query twice, then `unsubscribe()` once, the query would remain subscribed. It would be unsubscribed and its data would be removed from the model only after `unsubscribe()` was called once more.

This behavior is helpful, since multiple parts of a page may need the same resource, but they may want perform data loading and unloading independently. For example, an edit dialog may be opened and closed while some of the same data may be displayed in a list; or a migration script may fetch data in batches in order to process a large amount of data without loading all of it into memory simultaneously.

A model's context tracks all fetches and subscribes made under its context name. Calling `model.unload()` on the model will "undo" the unfetch and unsubscribe counts made under its context, while not affecting fetches and subscribes made under other contexts.

By default, all fetches and subscribes happen within the context named `'root'`. Additional context names may be used to isolate the loading and unloading of data within the same model for independent purposes.

Child models created with `model.at()`, `model.scope()`, etc. will inherit the context name from the parent model.

> `childModel = model.context(name)`
> * `name` A string uniquely identifying a context. Calling `model.context()` again with the same string will refer to the same context. By default, models have the context name `'root'`
> * `childModel` Returns a model with a context of `name`. All fetch, subscribe, and unload actions performed on this child model will be tracked under the new named context. The child model's path is inherited from the parent.

> `model.unload([name])`
> * `name` *(optional)* - A specific context name to unload. Defaults to the current model's context name.
> * Undoes the fetches and subscribes for all documents and queries loaded under the context. For each piece of data, if no other contexts hold fetches or subscribes on it, then this will end the subscription and remove the data from the model.

> `model.unloadAll()`
> * Unload all contexts within a model. Results in all remotely loaded data being removed from a model.
> * Data within [local collections](paths#local-and-remote-collections) will remain.
> * This is automatically called by Derby prior to doing a client-side render of a new page.

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
