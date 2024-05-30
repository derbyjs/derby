---
layout: default
title: Reactive functions (model.start)
parent: Models
---

# Reactive functions

Reactive functions provide a simple way to update a computed value whenever one or more objects change. While model events respond to specific model methods and path patterns, reactive functions will be re-evaluated whenever any of their inputs or nested properties change in any way.

Reactive functions may be run any number of times, so they should be [pure functions](https://en.wikipedia.org/wiki/Pure_function). In other words, they should always return the same results given the same input arguments, and they should be side effect free. By default, the inputs to the function are retrieved directly from the model, so be sure not to modify any object or array input arguments. For example, slice an array input before you sort it. The output of the model function is deep cloned by default.

To execute a model function, you then call `model.start()` or `model.evaluate()`.
* `evaluate()` runs a function once and returns the result.
* `start()` also sets up event listeners that continually re-evaluate the
  function whenever any of its input or output paths are changed.

> ```
> value = model.start(path, inputPaths, [options], fn)
> value = model.evaluate(inputPaths, [options], fn)
> ```
> ```
> // Legacy (racer &lt;= 0.9.5)
> value = model.start(path, inputPaths..., [options], fn)
> value = model.evaluate(inputPaths..., [options], fn)
> ```
>
> * `path` - _string \| ChildModel_ - The output path at which to set the value,
>   keeping it updated as input paths change
> * `inputPaths` - _Array<string \| ChildModel>_ - One or more paths whose values
>   will be retrieved from the model and passed to the function as inputs
> * `options` - _Object_ (optional)
>   * `copy` - Controls automatic deep copying of the inputs and output of the
>     function. _Model#evaluate never deep-copies output, since the return
>     value is not set onto the model._
>     - `'output'` (default) - Deep-copy the return value of the function
>     - `'input'` - Deep-copy the inputs to the function
>     - `'both'` - Deep-copy both inputs and output
>     - `'none'` - Do not automatically copy anything
>   * `mode` - The `model.set*` method to use when setting the output. _This has
>     no effect in Model#evaluate._
>     - `'diffDeep'` (default) - Do a recursive deep-equal comparison on old
>       and new output values, attempting to issue fine-grained ops on subpaths
>       where possible.
>     - `'diff` - Do an identity comparison (`===`) on the output value, and do
>       a simple set if old and new outputs are different.
>     - `'arrayDeep'` - Compare old and new arrays item-by-item using a
>       deep-equal comparison for each item, issuing top-level array insert,
>       remove, and move ops as needed. Unlike `'diffDeep'`, this will _not_
>       issue ops deep inside array items.
>     - `'array'` - Compare old and new arrays item-by-item using identity
>       comparison (`===`) for each item, issuing top-level array insert,
>       remove, and move ops as needed.
>   * `async` - _boolean_ - If true, then upon input changes, defer evaluation
>     of the function to the next tick, instead of immediately evaluating the
>     function upon each input change. _Introduced in [racer@0.9.5](https://github.com/derbyjs/racer/releases/tag/v0.9.5)._
>     - This can improve UI performance when multiple inputs to a reactive
>       function will change in the same event loop, as `async: true` will
>       mean the function only needs be evaluated once instead of N times.
>     - _Warning:_ Avoid using `async: true` if there's any controller code
>       that does a `model.get()` on the output path or any paths downstream
>       of the output, since changes to an input path won't immediately result
>       in the output being updated.
> * `fn` - _Function \| string_ -  A function or the name of a function defined
>   via `model.fn()`
>   * The function gets invoked with the values at the input paths, one input
>     per argument, and should return the computed output value.
>   * It should be a synchronous [pure function](https://en.wikipedia.org/wiki/Pure_function).
>     - One common side effect to avoid is `Array#sort` on an input array, since
>       that sorts the array in-place. If you need to do a sort, make a shallow
>       copy via `array.slice()` first, or use a sorting library that returns a
>       new array instead of sorting in-place.
>     - The function will be called both in Node and in the browser, so avoid
>       using functions whose behavior is implementation-dependent, such as the
>       one-argument form of [`String#localeCompare`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare).
>     - The function might get called with some inputs `undefined`, so be
>       defensive and check inputs' existence before using them.
> * Return `value` - The initial value computed by the function

> `model.stop(path)`
> * `path` The path at which the output should no longer update. Note that the value is not deleted; it is just no longer updated

In DerbyJS, `model.start()` functions should typically be established in the `init` method of a component. This method is called both before rendering on the server and then again before rendering in the browser. These reactive functions will be stopped as soon as the component is destroyed, which happens automatically when the component is removed from the page.

```js
MyComponent.prototype.init = function(model) {
  model.start('total', 'first', 'second', function sum(x, y) {
    return (x || 0) + (y || 0);
  });
};
```

## Two-way reactive functions

Most reactive functions define a getter only. You should treat their output as read only. In addition, it is possible to define two-way reactive functions with both a setter and a getter. Note that this is a more advanced pattern and should not be used unless you are confident that it is a strong fit for your use case.

```js
// Model functions created with just a function act as getters only.
// These functions update the output path when any input changes
model.fn('expensiveItems', function(items) {
  return items && items.filter(function(item) {
    return item.price > 100;
  });
});

// It is also possible to define both a getter and a setter function
// if the input values may be computed from setting the output
model.fn('fullName', {
  // The getter function gets the current value of each of the input
  // arguments when any input might have changed
  get: function(firstName, lastName) {
    return firstName + ' ' + lastName;
  },
  // The setter function is called with the value that was set at
  // the output path as well as the current value of the inputs.
  // It should return an array or object where each property is an
  // index that corresponds to each input argument that should be set.
  // If the function returns null, no items will be set.
  set: function(value, firstName, lastName) {
    return value && value.split(' ');
  }
});
```

## Named functions

In addition to passing in a function directly, a function can be defined on a model via a name. This name can then be used in place of a function argument.

> `model.fn(name, fn)`
> * `name` A name that uniquely identifies the function
> * `fn` A getter function or an object with the form `{get: function(), set: function()}`

Reactive functions started on the server via a name are reinitialized when the page loads. In order to add functions for use in routes as well as in the client, use the `'model'` event emitted by apps, which occurs right before an app route is called on the server and once immediately upon initialization in the client. Then, you can safely start them in the appropriate route, and they will be re-established automatically on the client.

In DerbyJS, this pattern is generally less preferable to initializing model functions in a component.

```js
app.on('model', function(model) {
  // Sort the players by score and return the top X players. The
  // function will automatically update the value of '_page.leaders'
  // as players are added and removed, their scores change, and the
  // cutoff value changes.
  model.fn('topPlayers', function(players, cutoff) {
    // Note that the input array is copied with slice before sorting
    // it. The function should not modify the values of its inputs.
    return players.slice().sort(function (a, b) {
      return a.score - b.score;
    }).slice(0, cutoff - 1);
  });
});

app.get('/leaderboard/:gameId', function(page, model, params, next) {
  var game = model.at('game.' + params.gameId);
  game.subscribe(function(err) {
    if (err) return next(err);
    game.setNull('players', [
      {name: 'John', score: 4000},
      {name: 'Bill', score: 600},
      {name: 'Kim', score: 9000},
      {name: 'Megan', score: 3000},
      {name: 'Sam', score: 2000}
    ]);
    model.set('_page.cutoff', 3);
    model.start(
      // Output path
      '_page.topPlayers',
      // Input paths
      game.at('players'),
      '_page.cutoff',
      // Name of the function
      'topPlayers'
    );
    page.render();
  });
});
```
