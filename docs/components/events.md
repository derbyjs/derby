---
layout: default
title: Events
parent: Components
---

# Events

Functions defined on a property of a controller can be invoked from view expressions or in response to events. As a general pattern, view paths refer to the model when getting values and to the controller when calling functions.

Functions are looked up on the current component's controller, the page, and the global, in that order. See the [view functions and events](../views/template-syntax/functions-and-events#controller-property-lookup) documentation for more detail.

## Lifecycle events

Default events are triggered during the lifecycle of a component:

* `init`: Emitted before the component's `init()` function is called.
* `create`: Emitted before the component's `create()` function is called.
* `destroy`: Emitted before the component's `destroy()` function is called.

If the functions to be called aren't defined on the component, their respective events are still triggered unconditionally.

## Custom events

Components support custom events. Dashes are transformed into camelCase.
```derby
<modal on-close="reset()" on-full-view="back.fade()"></modal>
```
```js
// Equivalent to:
modal.on('close', function() {
  self.reset();
});
modal.on('fullView', function() {
  back.fade();
});
```

## Emitting events
Components can emit custom events to be handled by their parents.

```derby
<index:>
  <modal on-full-view="back.fade()"></modal>
```

```js
  //listen
  modal.on('fullView', function(foo) {
    console.log(foo);
  })
  //...
  //emit
  modal.emit("fullView", foo);
```


## Calling peer component methods

Components and elements can be set as a property on the current controller with the `as=` HTML attribute ([more detail](../views/template-syntax/paths#controller-properties)). This paired with how controller properties are looked up on function calls makes it easy to connect events on components or elements to methods on other components.

```derby
<!-- Connecting an instance of a component to an event -->
<modal as="modal"></modal>
<button on-click="modal.open()"></button>
```

```derby
<!-- `page` is available on all controllers, even in separate components -->
<flash as="page.flash"></flash>
...
<button on-click="page.flash.show('Clicked')"></button>
```

## Component event arguments

Component events implicitly pass through any emitted arguments. These arguments are added after any explicitly specified arguments in the expression.

```derby
<!-- Will log any arguments emitted by the submit event -->
<dropdown on-submit="console.log()"></dropdown>
<!-- Will log 'dropdown' followed by any emitted arguments -->
<dropdown on-submit="console.log('dropdown')"></dropdown>
```
