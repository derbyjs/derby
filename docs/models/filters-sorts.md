---
layout: default
title: Filters and sorts
parent: Models
---

# Filters and sorts

Filters create a live-updating list from items in an object. The results automatically update as the input items change.

> `filter = model.filter(inputPath, [additionalInputPaths...], [options], fn)`
> * `inputPath` A path pointing to an object or array. The path's values will be retrieved from the model via `model.get()`, and then each item will be checked against the filter function
> * `additionalInputPaths` *(optional)* Other parameters can be set in the model, and the filter function will be re-evaluated when these parameters change as well
> * `options:`
>   * `skip` The number of first results to skip
>   * `limit` The maximum number of results. A limit of zero is equivalent to no limit
> * `fn` A function or the name of a function defined via `model.fn()`. The function should have the arguments `function(item, key, object, additionalInputs...)`. Like functions for [`array.filter()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter), the function should return true for values that match the filter

```js
app.get('/search-pants', function(page, model, params, next) {
  model.subscribe('pants', function(err) {
    if (err) return next(err);
    model.filter('pants', 'pricing', 'color',
      // evaluate whether a pants item matches the search options
      function(item, pantsId, pants, pricing, color) {
        return item.price >= pricing.minimum
          && item.price <= pricing.maximum
          && item.color == color;
      }
    ).ref('_page.pantsList'); // bind the output of the filter
    page.render('pants');
  });
});
```

If `model.filter()` is called with `null` for the function, it will create a list out of all items in the input object. This can be handy as a way to render all subscribed items in a collection, since only arrays can be used as an input to `{{each}}` template tags.

> `filter = model.sort(inputPath, [options], fn)`
> * `inputPath` A path pointing to an object or array. The path's values will be retrieved from the model via `model.get()`, and then each item will be checked against the filter function
> * `options:`
>   * `skip` The number of first results to skip
>   * `limit` The maximum number of results. A limit of zero is equivalent to no limit
> * `fn` A function or the name of a function defined via `model.fn()`. The function should should be a compare function with the arguments `function(a, b)`. It should return the same values as compare functions for [`array.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)

There are two default named functions defined for sorting, `'asc'` and `'desc'`. These functions compare each item with Javascript's less than and greater than operators. See MDN for more info on [sorting non-ASCII characters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#Sorting_non-ASCII_characters).

You may define functions to be used in `model.filter()` and `model.sort()` via [`model.fn()`](reactive-functions#named-functions).

A filter may have both a filter function and a sort function by chaining the two calls:

```js
app.on('model', function(model) {
  model.fn('expensiveItem', function(item) {
    return item.price > 100;
  });
  model.fn('priceSort', function(a, b) {
    return b.price - a.price;
  });
});

app.get('/expensive-pants', function(page, model, params, next) {
  model.subscribe('pants', function(err) {
    if (err) return next(err);
    var filter = model.filter('pants', 'expensiveItem')
      .sort('priceSort');
    filter.ref('_page.expensivePants');
    page.render('pants');
  });
});
```

## Methods

The output of a filter is typically used by creating a reference from it. This sets the data in the model and keeps it updated.

> `scoped = filter.ref(path)`
> * `path` The path at which to create a refList of the filter's output
> * `scoped` Returns a model scoped to the output path of the ref

The filter's current value can also be retrieved directly via `filter.get()`.

> `results = filter.get()`
> * `results` Returns an array of results matching the filter

As well as by updating its input paths, a filter can be recomputed manually by calling its `filter.update()` method. This can also be used to perform pagination, since the the `filter.skip` and `filter.limit` properties can be modified followed by calling `filter.update()`.

> `filter.update()`

```js
var filter = model.sort('items', {skip: 0, limit: 10}, function(a, b) {
  if (a && b) return a.score - b.score;
});
// Logs first 10 items
console.log(filter.get());

filter.skip += filter.limit;
filter.update();
// Logs next 10 items
console.log(filter.get());
```
