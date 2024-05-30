---
layout: default
title: Paths
parent: Template syntax
grand_parent: Views
---

# Paths

Template paths use JavaScript syntax with a few small modifications.

## Model values

What would be identifiers for variable names in JavaScript get a value from the model and bind to any updates. If the path returns null or undefined, nothing is rendered.

Examples of rendering model values:

```jinja
{{user.name}}

{{user.bestFriends[0].name}}

{{users[userId].name}}
```

```js
model.get('user.name');

model.get('user.bestFriends.0.name');

var userId = model.get('userId');
model.get('users.' + userId + '.name');
```

## Attributes

Values are passed into views with attributes. Within the view, these values are accessed via paths that start with an at sign (`@`). In addition, there is an `@content` attribute created for any content inside of a view tag.

```jinja
<Body:>
  <ul class="nav-links">
    <view is="nav-link" href="/">Home</view>
    <view is="nav-link" href="/about">About us</view>
  </ul>

<nav-link:>
  <li>
    {{if $render.url === @href}}
      <b>{{@content}}</b>
    {{else}}
      <a href="{{@href}}">{{@content}}</a>
    {{/if}}
  </li>
```

See [View attributes](view-attributes) for additional detail on passing data to views.

## Aliases

Aliases label path expressions. They must begin with a hash (`#`) character to make it more obvious whether a path is an alias or a model value. Each of the block types support defining aliases with the `as` keyword.

Aliases make it possible to refer to the scope of the current block or a parent block.

```jinja
{{with user as #user}}
  <h1>{{#user.name}}</h1>
  <h2>{{#user.headline}}</h2>
  {{if #user.friendList as #friendList}}
    <!-- Note that we can refer to the parent scope -->
    <h3>Friends of {{#user.name}}</h3>
    <ul>
      {{each #friendList as #friend}}
        <li>{{#friend.name}}</li>
      {{/each}}
    </ul>
  {{/if}}
{{/with}}
```

## Relative paths - DEPRECATED

Relative view paths begin with `this`. They refer to the expression in the containing block.

Aliases are preferred to relative paths, as they are more clear. Relative paths came from implementing a syntax inspired by Handlebars, but Derby has been moving toward increased consistency with JavaScript, and the alternate use of the keyword `this` is confusing. Expect that this feature will be removed in a future version of Derby.

```jinja
{{with user}}
  <h1>{{this.name}}</h1>
  <h2>{{this.headline}}</h2>
  {{if this.friendList}}
    <h3>Friends</h3>
    <ul>
      {{each this}}
        <li>{{this.name}}</li>
      {{/each}}
    </ul>
  {{/if}}
{{/with}}
```
