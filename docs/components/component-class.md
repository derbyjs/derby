---
layout: default
title: Component class
parent: Components
---

# Component class

Derby provides a base class `Component`, from which all component classes inherit. When authoring a component, you can extend Derby's Component class with JavaScript, TypeScript, or CoffeeScript `extends` syntax.

```js
const Component = require('derby').Component;
class MyComponent extends Component {
  ...
}
app.component(MyComponent);
```

For convenience, if you register a class that does not inherit from `Component`, Derby will add `Component.prototype` to your class's prototype chain. In other words, Derby will make sure that your class inherits from `Component` at the time that you call `app.component()`.

```js
class MyComponent {
  ...
}
app.component(MyComponent);
```

## Component configuration

Components are configured by defining the following static properties and methods:

> `MyComponent.view = '/path/to/view'` The relative file path to a template file to load. If the view file is named *index.html* and in the same directory as the controller, `__dirname` can be used

> `MyComponent.is = 'my-component'` The name to use for the component's view. Often this doesn't need to be specified, because it defaults to the basename of the file or directory.

> `MyComponent.DataConstructor` Constructor function for setting default values in the component's model data. Properties will be overriden by view attributes.

> `MyComponent.prototype.init = function(model)` Called immediately before the view is rendered. Data and reactive functions can be initialized on the component's scoped model. This method is invovked both on the server and on the client, so the DOM and browser-only methods may not be used within init().

> `MyComponent.prototype.create = function(model, dom)` Called in the browser when a component is loaded and inserted into the DOM. This method is never called on the server. DOM-related code and model event listeners should be placed in create().


## Properties

> `model`: The component's scoped model.

> `dom`: An instance of Derby's wrapper around DOM methods. This should be used for adding and removing listeners to DOM events rather than native `addEventListener()`. This is important so that Derby can remove listeners when the component is destroyed.

> `page`: Reference to the current page object, which is the top level controller. A new page object is created on navigation to a new URL.

> `app`: Reference to the current app object. The app is persistent for the entire session.

> `parent`: Reference to the containing controller.

> `context`: The rendering context object.

> `id`: The unique id assigned to the component.

> `isDestroyed`: Initially set to `false`. Set to `true` when the component is fully destroyed.


## Methods

### Event emission

Components are Node.js event emitters, so they inherit the `on`, `once`, `emit`, `removeListener`, etc. methods from [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

### Cleanup

> `component.destroy()`
>
> Derby calls this method when removing a component's marker comment from the DOM. `destroy()` emits the `'destroy'` event on the component. Listen for the destroy event in order to implement custom cleanup logic. This method should not be invoked manually.

```jinja
<view is="my-component" on-destroy="handleDestroy()"></view>
```

```js
class MyComponent extends Component {
  create() {
    this.on('destroy', function() {
      // Custom cleanup logic
    });
  }
}
```

> `boundFn = component.bind(fn)`
> * `fn` - _Function_ - A function to be invoked with the component as its `this` value. In addition, the function will no longer be invoked once the component is destroyed
> * `boundFn` - _Function_ - Returns a bound function, similar to JavaScript's `Function.bind()`. This function is safer to use in asynchronous code, such as with setTimeout, requestAnimationFrame, or requests to the server, because it won't call back after the component is destroyed. Internally, references to `fn` and the component are removed on `'destroy'`, which allows them to be garbage collected even if a reference to `boundFn` is held.

```js
class MyComponent extends Component {
  load() {
    this.set('loading', true);
    setTimeout(this.bind(function() {
      // This won't execute if the component has been destroyed
      this.set('loading', false);
    }), 200);
  }
}
```

### Throttling and debouncing

Derby components have built-in support for common throttling and debouncing patterns. These methods are similar to those provided by general-purpose libraries like Lodash, but they also bind the `this` value to the component, provide added safety by not calling back after a component is destroyed, and release references to `fn` and the component on `'destroy'`, same as `component.bind(fn)`.

> `throttledFn = component.throttle(fn, [delayArg = 0])`
>
> When passing in a numeric delay, calls the function at most once per that many milliseconds. Like Lodash, the function will be called on the leading and the trailing edge of the delay as appropriate. Unlike Lodash, calls are consistently called via setTimeout and are never synchronous. This should be used for reducing the frequency of ongoing updates, such as scroll events or other continuous streams of events.
>
> Additionally, implements an interface intended to be used with [window.requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame), process.nextTick, or window.setImmediate. If one of these is passed, it will be used to create a single async call following any number of synchronous calls. This mode is typically used to coalesce many synchronous events (such as multiple model events) into a single async event.
>
> Like `component.bind()`, will no longer call back once the component is destroyed, which avoids possible bugs and memory leaks.

```js
class MyComponent extends Component {
  create() {
    // Call this.update() at most once every 75 milliseconds
    this.dom.on('scroll', window, this.throttle(this.update, 75));
  }
  update() {
    // Update based on scroll location
  }
}
```

```js
class MyComponent extends Component {
  create() {
    // Call this.update() at most once before each paint (typically 60 times / second)
    this.dom.on('scroll', window, this.throttle(this.update, window.requestAnimationFrame));
  }
  update() {
    // Update based on scroll location
  }
}
```

> `debouncedFn = component.debounce(fn, [delay = 0])`
>
> Suppresses calls until the function is no longer called for that many milliseconds. This should be used for delaying updates triggered by user input, such as window resizing, or typing text that has a live preview or client-side validation. This should not be used for inputs that trigger server requests, such as search autocomplete; use debounceAsync for those cases instead.
>
> Like `component.bind()`, will no longer call back once the component is destroyed, which avoids possible bugs and memory leaks.

```jinja
<my-component:>
  <input as="textInput" value="{{value}}">
```

```js
class MyComponent extends Component {
  create() {
    // Suppress calls until the user has stopped typing for 300 milliseconds
    this.dom.on('input', this.textInput, this.debounce(this.update, 300));
  }
  update() {
    // Update based on current value
  }
}
```

> `asyncDebouncedFn = component.debounceAsync(fn, [delay = 0])`
>
> Like debounce(), suppresses calls until the function is no longer called for that many milliseconds. In addition, suppresses calls while the callback function is running. In other words, the callback will not be called again until the supplied `done()` argument is called. When the debounced function is called while the callback is running, the callback will be called again immediately after `done()` is called. Thus, the callback will always receive the last value passed to the debounced function.
>
> This avoids the potential for multiple callbacks to execute in parallel and complete out of order. It also acts as an adaptive rate limiter. Use this method to debounce any field that triggers an async call as the user types.
>
> Like `component.bind()`, will no longer call back once the component is destroyed, which avoids possible bugs and memory leaks.

```jinja
<my-component:>
  <input as="textInput" value="{{value}}">
```

```js
class MyComponent extends Component {
  create() {
    // Suppress calls until the user has stopped typing for 300 milliseconds
    // and the async function has completed
    this.dom.on('input', this.textInput, this.debounceAsync(this.search, 300));
  }
  search(done) {
    const query = this.model.get('value');
    fetch('/api/search?q=' + query)
      .then(response => {
        this.model.set('response', response);
      })
      .catch(err => console.error(err))
      // No additional calls to search will happen until done() is called
      .finally(done);
  }
}
```
