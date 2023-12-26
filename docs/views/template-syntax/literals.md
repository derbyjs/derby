---
layout: default
title: Literals
parent: Template syntax
grand_parent: Views
---

# Literals

Derby supports creating JavaScript literals in templates. The syntax is identical to JavaScript, except that identifiers within literals are parsed as [view paths](paths) instead of JavaScript variables. Derby parses template expressions with Esprima, so its coverage of JavaScript expression syntax is comprehensive.

## Simple literals

```derby
<!-- Numbers -->
{{0}}
{{1.1e3}}
{{0xff}}
<!-- Booleans -->
{{true}}
{{false}}
<!-- Strings -->
{{'Hi'}}
{{"Hey"}}
<!-- Regular expressions -->
{{/([0-9])+/}}
<!-- null -->
{{null}}
<!-- undefined -->
{{undefined}}
<!-- Arrays -->
{{ [0, 1, 2] }}
<!-- Objects -->
{{ {name: 'Jim'} }}
```y, simple literals are instantiated at the time of parsing. Object literals created at parse time will be passed by reference to controller functions, so be careful not to modify them.

```derby
<!-- CAUTION: ```derby
<!-- CAUTION: This array will be the same object on each function call -->
<button on-click="doStuff([1, 2, 3])"></button>
```ls in template expressions. In most cases, it makes more sense to define constants in the controller or use HTML, but this can be handy when prototyping and debugging.

```derby
<ul>
  {{each ['A', 'B', 'C'] as #let```derby
<ul>
  {{each ['A', 'B', 'C'] as #letter}}
    <li>{{#letter}}</li>
  {{/each}}
</ul>

{{with {name: 'Jim', age: 23} as #user}}
  <h1>{{#user.name}}</h1>
  <h2>{{#user.age}}</h2>
{{/with}}
``` at render time and populated with the appropriate values from the model.

```derby
<ul>
  {{each [first, 1, 2, 3] as #item}}
    <li>{{#item}}<```derby
<ul>
  {{each [first, 1, 2, 3] as #item}}
    <li>{{#item}}</li>
  {{/each}}
</ul>

<button on-click="addNew({userId: #user.id})"></button>
```