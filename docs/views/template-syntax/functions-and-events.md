---
layout: default
title: Functions and events
parent: Template syntax
grand_parent: Views
---

# Functions and events

Attributes beginning with `on-` add listeners to DOM events and component events. Under the hood, events on elements are added with `element.addEventListener()` and events on components are added with `component.on()`. Adding events declaritively with attributes is easier than CSS selectors and less prone to unexpectedly breaking when refactoring templates or classes for styling.

```jinja
<!-- Any event name can be added to an element -->
<input on-mousedown="mousedownInput($event)" on-blur="blurInput(), update()">
```

```js
// Equivalent to:
input.addEventListener('mousedown', function(event) {
  self.mousedownInput(event);
}, false);
input.addEventListener('blur', function(event) {
  self.blurInput();
  self.update();
}, false);
```

## View functions

Functions are looked up on the current component's controller, the page, and the global, in that order. The majority of functions are defined on component prototypes, generic shared utility functions are defined on the page prototype, and the global provides access to functions like `new Date()` and `console.log()`.

```jinja
<!-- Call component method -->
<button on-click="delUser(#user.id)"></button>
<!-- Call utility function on page -->
{{sum(1, 2, 4)}}
<!-- Call method of global -->
{{console.log('rendering value', value)}}
```

```js
// component prototypes are where most functions are defined
UserList.prototype.delUser = function(userId) {
  this.users.del(userId);
};

// app.proto is the prototype for all pages created by the app
app.proto.sum = function() {
  var sum = 0;
  for (var i = 0; i < arguments.length; i++) {
    sum += arguments[i];
  }
  return sum;
};
```

### Component events
Components support custom events. Dashes are transformed into camelCase.

See the [component events](../../components/events) documentation for more detail on using events and component functions.
```jinja
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


### Special HTML rules

As a convenience, an `on-click` listener can be added to a link without an `href`. Derby will add an `href="#"` and prevent the default action automatically if no href is specified.

```jinja
<!-- Derby will add an href="#" when there is a click handler -->
<a on-click="alert('hi')">Hi</a>
```

HTML forms have very useful behavior, but their default action on submit will navigate away from the current page. If an `on-submit` handler is added to a form with no `action` attribute, the default will be prevented.

```jinja
<form on-submit="console.log()">
  <input value="{{newValue}}">
  <button type="submit">Add</button>
  <button type="reset">Reset</button>
  <!-- Note that HTML buttons default to type="submit" -->
  <button type="button">Cancel</button>
</form>
```

### DOM event arguments

For functions invoked by DOM events only, the special arguments `$event` or `$element` may be specified. The `$event` argument is the DOM Event object passed to the listener function for `addEventListener()`. The `$element` argument is a reference to the element on which the listener attribute is specified. These arguments are only passed to functions if explicitly specified.

```jinja
<table>
  <tbody>
    {{each rows as #row}}
      <tr on-click="clickRow($event, $element)">
        <td><a href="{{#row.href}}">{{#row.name}}</a></td>
        <td>{{#row.description}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
```

```js
UserList.prototype.clickRow = function(e, tr) {
  // Ignore clicks on or in links
  var node = e.target;
  while (node && node !== tr) {
    if (node.tagName === 'A') return;
    node = node.parentNode;
  }
  // Cancel the original click event inside of the row
  e.stopPropagation();
  // Pretend like the click happened on the first link in the row
  var event = new MouseEvent('click', e);
  var link = tr.querySelector('a');
  if (link) link.dispatchEvent(event);
};
```

## Scoped model arguments

Functions can be passed the value of any view path. In some cases, it can be convenient to get a [scoped model](../../models/paths#scoped-models) to the view name instead. To pass a scoped model, you can wrap the view path in `$at()`. Instead of getting the value for a view path, this will return a scoped model. It will return undefined if no scoped model can be created for a view path.

```jinja
<button on-click="toggle($at(showDetail))"></button>
```

```js
app.proto.toggle = function(scoped) {
  scoped.set(!scoped.get());
};
```