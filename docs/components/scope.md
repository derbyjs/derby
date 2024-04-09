---
layout: default
title: Scope
parent: Components
---

# Scope

Each component instance has its own scoped model, providing it isolation from model data for other components and remote collection data.

## Attributes and data bindings

The most direct way to get data into a component is to pass in a reference or a literal as a view attribute.

```derby
<Body:>
  <view is="user-list" data="{{users}}" num="{{7}}"></view>

<user-list:>
  <ul>
    {{each data as #user}}
      <li>{{#user.name}}</li>
    {{/each}}
  </ul>
  {{num + 10}}
```

See [view attributes](../views/template-syntax/view-attributes) for more information.


## Root model

There are times when accessing data in the root model is desirable from within the component. This can be achieved both in the template and in the controller.

```derby
<index:>
  <!-- dynamically look up a user in the users collection -->
  {{#root.users[userId]}}
```

```js
  var users = this.model.root.get("users");
  var user = users[userId];
  // or
  var $users = this.model.scope("users");
  var user = $users.get(userId);
```


### With block
See the documentation for [with blocks](../views/template-syntax/blocks#with) to pass in data with an alias.

