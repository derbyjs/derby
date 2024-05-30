---
layout: default
title: Blocks
parent: Template syntax
grand_parent: Views
---

# Blocks

Blocks are template expressions that start with special keywords. They are used to conditionally render, repeat, or control the way in which sections of a template are rendered.

Similar to HTML tags, blocks end in a forward slash followed by the same keyword that started them. The closing keyword is optional but recommended for clarity. For example, both `{{with}}...{{/with}}` and `{{with}}...{{/}}` are parsed correctly.

# Conditionals

Conditional blocks use the `if`, `else if`, `else`, and `unless` keywords. They render the first template section that matches a condition or nothing if none match. Like in Mustache and Handlebars, zero length arrays (`[]`) are treated as falsey. Other than that, falsey values are the same as JavaScript: `false`, `undefined`, `null`, `''`, and `0`.

```jinja
{{if user.name}}
  <h1>user.name</h1>
{{else if user}}
  <h1>Unnamed user</h1>
{{else}}
  No user
{{/if}}
```

The inverse of `if` is `unless`. For clarity, unless should only be used when there is no `else` condition. A block that has an unless and else condition can usually be writtern more clearly as an if and else.

```jinja
{{unless items}}
  Please add some items
{{/unless}}
```

The contents of a conditional block are only re-rendered when a different condition starts to match. If the values in the conditional change, the condition expression is evaluated, but the DOM is not updated if the same section matches.

# Each

Each blocks repeat for each of the items in an array. They cannot iterate over objects.

```jinja
{{each items}}
  <p>{{this.text}}</p>
{{else}}
  No items
{{/each}}
```

In addition to an alias to the array item, eaches support an alias for the index of the item. This index alias supports binding and will be updated as the array changes.

```jinja
{{each items as #item, #i}}
  {{#i + 1}}. {{#item.text}}
{{/each}}
```

Derby has very granular model events to describe array mutations as inserts, removes, and moves. It maps these directly into efficient DOM mutations of just what changed.

# With

With blocks set the path context of a block, but they do not trigger re-rendering. Their primary use is to set an alias to a path inside of their contents.

Aliases can be a convenient way to set a name that can be used throughout a section of a template or many nested views and/or components.

```jinja
<Body:>
  {{with _session.user as #user}}
    <view is="user-profile"></view>
  {{/with}}

  {{with {name: 'Jim', age: 32} as #user}}
    <view is="user-profile"></view>
  {{/with}}

<user-profile:>
  <h1>{{#user.name}}</h1>
  <p class="age">{{#user.age}}</p>
```

# On

To clear UI state, to optimize performance by rendering larger sections, or to work around issues with template bindings not rendering often enough, an `{{on}}` block can provide more control. Its contents will re-render whenever any of its paths change.

```jinja
{{on #profile.id}}
  <h1>{{#profile.name}}</h1>
  <!-- Re-render entire section whenever #profile.id changes -->
{{/on}}

{{on first, second, third}}
  <!-- Re-render entire section when one of multiple dependencies changes -->
{{/on}}
```

# Unbound and bound

Bindings are created by default for all template expressions. To render an initial value only and not create bindings, the `{{unbound}}` block may be wrapped around a template section. Bindings can be toggled back on with a `{{bound}}` block.

```jinja
{{unbound}}
  <!-- Disable creation of bindings and only render initial value -->
  {{bound}}
    <!-- But do bind expressions inside here -->
  {{/bound}}
{{/unbound}}
```
