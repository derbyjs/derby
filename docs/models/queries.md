---
layout: default
title: Queries
parent: Models
---

# Queries

Racer can fetch or subscribe to queries based on a model value or a database-specific query. When fetching or subscribing to a query, all of the documents associated with that query are also fetched or subscribed.

> `query = model.query(collectionName, path)`
> * `collectionName` The name of a collection from which to get documents
> * `path` A model path whose value contains a documentId or an array of documentIds

> `query = model.query(collectionName, databaseQuery)`
> * `collectionName` The name of a collection from which to get documents
> * `databaseQuery` A query in the database native format, such as a MonogDB query

# MongoDB query format

The `sharedb-mongo` adapter supports most MongoDB queries that you could pass to the Mongo `find()` method. See the [Mongo DB query documentation](https://docs.mongodb.org/manual/core/read-operations/#read-operations-query-document) and the [query selectors reference](https://docs.mongodb.org/manual/reference/operator/#query-selectors). Supported MongoDB cursor methods must be passed in as part of the query. `$sort` should be used for sorting, and skips and limits should be specified as `$skip` and `$limit`. There is no `findOne()` equivalent&mdash;use `$limit: 1` instead.

Note that projections, which are used to limit the fields that a query returns, may not be defined in the query. Please refer to the [guide on using projections](https://github.com/derbyparty/derby-faq/tree/master/en#i-dont-need-all-collections-fields-in-a-browser-how-to-get-only-particular-fields-collections-projection), which you can follow if you only want specific fields of a document transferred to the browser.

## Query results

After a query is subscribed or fetched, its results can be returned directly via `query.get()`. It is also possible to create a live-updating results set in the model via `query.ref()`.

> `results = query.get()`
> * `results` Creates and returns an array of each of the document objects matching the query

> `scoped = query.ref(path)`
> * `path` Local path at which to create an updating refList of the queries results
> * `scoped` Returns a model scoped to the path at which results are output
