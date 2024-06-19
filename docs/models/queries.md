---
layout: default
title: Queries
parent: Models
---

# Queries

Racer can fetch or subscribe to queries based a database-specific query.

When fetching or subscribing to a query, all of the documents associated with that query's results are also individually loaded into the model, as if they were fetched/subscribed.

First, create a Query object.

> `query = model.query(collectionName, databaseQuery)`
> * `collectionName` The name of a collection from which to get documents
> * `databaseQuery` A query in the database native format, such as a MonogDB query

Next, to actually run the query, it needs to be subscribed or fetched. For details on subscribing vs fetching, see the ["Loading data into a model" documentation](./backends#loading-data-into-a-model).

- Query objects have subscribe and fetch methods:
  - Callback API - `query.subscribe(callback)` and `query.fetch(callback)`. The callback `(error?: Error) => void` is called when the query data is successfully loaded into the model or when the query encounters an error.
  - Promise API - `query.subscribePromised()` and `query.fetchPromised()`. They return a `Promise<void>` that is resolved when the the query data is successfully loaded into the model, or is rejected when the query encounters an error.
- The general `model.subscribe` and `model.fetch` methods also accept query objects, which is useful to execute multiple queries in parallel.
  - Callback API - `model.subscribe([query1, query2, ...], callback)` and `model.fetch([query1, query2, ...], callback)`
  - Promise API _(since racer@1.1.0)_ - `model.subscribePromised([query1, query2, ...])` and `model.fetchPromised([query1, query2, ...])`
  - See ["Loading data into a model" documentation](./backends#loading-data-into-a-model) for more details.

## Query results

After a query is subscribed or fetched, its results can be returned directly via `query.get()`. It is also possible to create a live-updating results set in the model via `query.ref()`.

> `results = query.get()`
> * `results` Creates and returns an array of each of the document objects matching the query

> `scoped = query.ref(path)`
> * `path` Local path at which to create an updating refList of the queries results
> * `scoped` Returns a model scoped to the path at which results are output

## Examples

These examples use the MongoDB query format, as sharedb-mongo is the most mature DB adapter for ShareDB. Adjust the query expressions as needed based on your DB adapter.

### Callback API

```js
const notesQuery = model.query('notes', { creatorId: userId });

// Frontend code usually subscribes.
// Subscribing to multiple things in parallel reduces the number of round-trips.
model.subscribe([notesQuery, `users.${userId}`], (error) => {
  if (error) {
    return handleError(error);
  }
  // Add a reference to the query results to get automatic UI updates.
  // A view can use these query results with {{#root._page.notesQueryResults}}.
  notesQuery.ref('_page.notesQueryResults');
  // Controller code can get the results either with the query or with the ref.
  console.log(notesQuery.get());
  console.log(model.get('_page.notesQueryResults'));
  // Documents from the results are also loaded into the model individually.
  model.get(`notes.${notesQuery[0].id}`);
});

// Backend-only code usually only needs to fetch.
notesQuery.fetch((error) => {
  if (error) {
    return handleError(error);
  }
  console.log(notesQuery.get());
});
```

### Promise API

_(since racer@1.1.0)_

```js
const notesQuery = model.query('notes', { creatorId: userId });

// Frontend code usually subscribes.
// Subscribing to multiple things in parallel reduces the number of round-trips.
try {
  await model.subscribePromised([notesQuery, `users.${userId}`]);
} catch (error) {
  return handleError(error);
}
// Add a reference to the query results to get automatic UI updates.
// A view can use these query results with {{#root._page.notesQueryResults}}.
notesQuery.ref('_page.notesQueryResults');
// Controller code can get the results either with the query or with the ref.
console.log(notesQuery.get());
console.log(model.get('_page.notesQueryResults'));

// Backend-only code usually only needs to fetch.
try {
  await notesQuery.fetchPromised();
} catch (error) {
  console.log(notesQuery.get());
}
```

## MongoDB query format

The `sharedb-mongo` adapter supports most MongoDB queries that you could pass to the Mongo `find()` method. See the [Mongo DB query documentation](https://docs.mongodb.org/manual/core/read-operations/#read-operations-query-document) and the [query selectors reference](https://docs.mongodb.org/manual/reference/operator/#query-selectors). Supported MongoDB cursor methods must be passed in as part of the query. `$sort` should be used for sorting, and skips and limits should be specified as `$skip` and `$limit`. There is no `findOne()` equivalent&mdash;use `$limit: 1` instead.

Note that projections, which are used to limit the fields that a query returns, may not be defined in the query. Please refer to the [guide on using projections](https://github.com/derbyparty/derby-faq/tree/master/en#i-dont-need-all-collections-fields-in-a-browser-how-to-get-only-particular-fields-collections-projection), which you can follow if you only want specific fields of a document transferred to the browser.
