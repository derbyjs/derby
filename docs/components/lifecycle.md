---
layout: default
title: Lifecycle
parent: Components
---

# Component lifecycle


Components are defined by writing a view template in HTML and a JavaScript controller class. Calling `app.component(MyComponent)` registers the view and controller with a Derby app. After that, an instance of the component class is created whenever its view is rendered.


## Rendering

Derby components are designed for efficient server-side HTML and client-side DOM rendering with the same code.


### Client-side rendering

*1. `new MyComponent.DataConstructor()`:* First, Derby instantiates an object that is used for the component's model data. This class should be defined to set default values that can be used in either the view or the controller of the component. Derby will set two properties, `id` and `$controller`, on this object. `id` is a string id unique to the component, and `$controller` is a reference to the component instance. These properties are set in the model data so that they can be used in the view.

*2. `new MyComponent(context, data)`:* Derby calls the component's constructor with a rendering context object and the model data instance. As is idiomatic in JavaScript, it is recommended that `super(context, data)` is called at the top, and instance properties are set following that. Note that attributes passed in from the view are not yet set on the model.

*3. `Component(context, data)`:* Derby's component constructor creates the component's `id` and `model`. If the custom constructor does not call super, Derby calls this method immediately after. Effectively, components behave like there was a call to super at the end of their constructor when super isn't called explicitly.

*4. Attribute values from the view are set on the model:* Attribute values are passed into compoenents via the view. Derby sets and binds these values to the model after invoking the constructor.

*5. `'init'` event:* Derby emits an `'init'` event on the component instance before calling the init method. This event is rarely used. However, it is provided in case containing components need to obtain a reference to a component instance before it renders.

*6. `MyComponent.init(model)`:* Init is called once Derby has completed all steps to initialize the component and before rendering. All custom code that initializes data in the model prior to rendering, such as reactive functions, should be placed within the component's `init()` implementation.

*7. Rendering:* Following `init()`, Derby renders the component's view and inserts it into the DOM. Hooks defined in the view, such as the `as` attribute for assigning elements and components to controller properties or `on-` attributes for adding event listeners happen at render time as well.

*8. `'create'` event:* On the client only, Derby emits a `'create'` event on the component instance before calling the create method. Similar to the `'init'` event, this method is provided in case containing components need to obtain a reference to a component instance. However, the create event only happens on the client, and it is emitted after the component is rendered and inserted into the DOM.

*9. `MyComponent.create(model, dom)`:* Create is called once the component is rendered and inserted into the DOM. Custom code that adds model or DOM event listeners should be placed within the component's `create()` implementation.


### Server-side rendering

Steps 1-7 of the rendering process are the same for server-side rendering. However, instead of using DOM methods to render, Derby returns a string of HTML. The key difference between client-side and server-side rendering is that `create()` is called only on the client, and server-side rendering happens within Node.js instead of the browser.

There are a number of differences between Node.js and a browser environment that must be taken into account:

* Server time and client time will differ. Client-time may differ by small or large amounts, and its accuracy cannot be ensured.

* Servers do not have a session-appropriate timezone or locale, so JavaScript's `Date` and `Intl` features cannot be used without ensuring that the server and client are using matching implementations and configurations.

* No DOM methods are available on the server.

* There is no need to create bindings and event listeners on the server, because data will not be dynamically changing.

* Servers are multi-tenent and long lived, so be careful to avoid global state in components. This is also a best practice in client-only applications, but it is especially important when code is executed on both the server and the client. On the server, shared state could lead to data being leaked from one session to another, and minor memory leaks in long-lived processes can build up and crash a server.


### Server-side rendering + Client-side attachment

Out of the box, Derby is optimized for server + client-side rendering. This can greatly improve perceived load time, since the browser can display the application before its scripts have loaded or executed on the client.

In this type of rendering, the server renders HTML, and the browser creates DOM nodes from HTML. Then, Derby does a special kind of rendering called "attachment," where it does all of the client-side rendering steps. However, it uses the existing DOM nodes in the page rather than creating new DOM nodes.

Therefore, component code must be deterministic. Pure code, where the same inputs return the same results and there are no side effects, is best. Common pitfalls:

* Components should not rely on external inputs, such as `Date.now()` or the result of `Math.random()` in rendering, because their results will differ on subsequent calls. You can compute the values ahead of time and store them in the model on `_session` or `_page`, so that the values will be the same when rendered on the server and after the initial page load in the client. You may also choose to render certain values in the client only, by setting them in `create()`.

* Sorting should use a stable comparison.

* Rendering components should not modify persistent state or have other side effects.


In addition, Derby requires that parsing the HTML in templates produces a matching DOM. Common pitfalls:

* Templates must be valid HTML. For example, `<p><div></div></p>`, is invalid HTML and will produce a DOM such as `<p></p><div></div><p></p>`. This is because the [`<p>` element](https://html.spec.whatwg.org/multipage/grouping-content.html#the-p-element) may contain only [phrasing content](https://html.spec.whatwg.org/multipage/dom.html#phrasing-content), and the start of a `<div>` closes the `<p>`.

* Templates must explicitly include all [optional tags](https://html.spec.whatwg.org/multipage/syntax.html#optional-tags). For example, `<table><tr><td></td></tr></table>` is valid HTML, but it will produce the DOM `<table><tbody><tr><td></td></tr></tbody></table>`. For simplicity, Derby does not attempt to implement these rules and requires that optional tags be written out.

* All non-void elements must be explicitly closed. For example, `<ul><li>One<li>Two</ul>` is valid HTML, because an `<li>` elements' end tags are implied. Derby requires that this be written out fully as `<ul><li>One</li><li>Two</li></ul>`. ([Void elements](https://html.spec.whatwg.org/multipage/syntax.html#void-elements) like `<img>` only have a start tag and the end tag must not be specified.)

To test whether an HTML fragment will work in a Derby template, use an [HTML validator](https://validator.nu/) and check that setting then reading it back as `innerHTML` returns the same string.

```js
var html = '<p><div></div></p>';
var div = document.createElement('div');
div.innerHTML = html;
html === div.innerHTML;
```


## Cleanup

When a binding causes a component to be removed from the DOM, Derby internally calls its `destroy()` method. (This method should not be invoked manually.) Destroying a component removes its DOM listeners, destroys its model data and model listeners, removes references created by `as` attributes in views, and removes all of Derby's internal references to the component and bindings within the component. Each of these is important for avoiding memory leaks.

Using Derby's built-in features to add DOM listeners, model listeners, and bind asynchronous callbacks generally avoids the need to implement custom cleanup code. If custom cleanup code is needed, it can be implemented by listening to the component's `'destroy'` event or checking whether the component's `isDestroyed` property is `true`.


### Singleton (stateless) components

Creating a model per component, binding component attributes, and cleaning up component models and bindings can add significant overhead. However, Derby's template syntax is very expressive, and many components can be written in a stateless manner with no need for their own model.

In this case, it is best to declare the component as a "singleton" component. A singleton component is also implemented with a JavaScript class for a controller, but Derby will only instantiate the class once and reuse the same instance of the class each time the component's view is rendered. Derby will not create a model or other properties on the controller, since its instance can be used in multiple places simultaneously. In addition, rendering a singleton component does not invoke `init()`, `create()`, or `destroy()`.

Since singleton components do not have a model, only attribute paths may be used in views. Singleton controllers should consist of only pure functions.

When a component is used many times on a page, such as a repeated item in a list or a commonly used UI element, it is best to write it statelessly for better performance. View partials are the most lightweight, singleton components allow use of custom JavaScript, and full components have their own model state.

```jinja
<user-icon:>
  <div class="user-icon">
    {{getInitials(@user.fullName)}}
  </div>
```

```js
app.component('user-icon', class UserIcon {
  static singleton = true;
  getInitials(fullName) {
    return fullName.split(' ').map(name => name[0]).join('');
  }
});
```
