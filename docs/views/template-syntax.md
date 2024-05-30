---
layout: default
title: Template syntax
parent: Views
has_children: true
---

# Template syntax

Derby’s template syntax is loosely based on [Handlebars](https://handlebarsjs.com/), a semantic templating language that extends [Mustache](https://mustache.github.io/mustache.5.html).

Semantic templates encourage separation of logic from presentation. Instead of arbitrary code, there are a small set of template expressions. During rendering, data are passed to the template, and template expressions are replaced with the appropriate values. In Derby, this data comes from the model.

Derby supports calling controller functions and the full JavaScript expression syntax. Expressions are parsed with [Esprima](http://esprima.org/) and do not use JavaScript's `eval()` or `new Function()`.

## HTML

With the exception of templates that return strings and the contents of `<script>` and `<style>` elements, Derby templates must conform to HTML rules.

Templates are parsed as HTML and transformed into Template objects. These Template objects can directly create HTML for server rendering or DOM nodes for client rendering. Derby does not do string interpolation of HTML and does not use innerHTML to update the page in the client.

Derby's HTML parser is quite simple, so you must write **valid HTML**, you must **close all tags** that are optionally closed such as `<p>` and `<li>`, and you must explicity **write out implied elements**, such as a `<tbody>` within a `<table>`. Supporting the full complexity of HTML5 parsing rules would add extra overhead without any substantive benefit.

HTML attribute values only need to be quoted if they are the empty string or if they contain a space, equals sign, or greater than sign. Derby parses unquoted attributes correctly, but always using **quotes around all attribute values** is recommended.

#### Invalid template expression placements
```jinja
<!-- INVALID: Within element names -->
<{{tagName}}>Bad bad!</{{tagName}}>

<!-- INVALID: Within attribute names -->
<b {{attrName}}="confused" {{booleanAttr}}>Bad bad!</b>

<!-- INVALID: Splitting an html tag -->
<b{{if maybe}}>Bad bad!</b{{/if}}>

<!-- INVALID: Splitting an element -->
{{if maybe}}<b>{{/if}}Bad bad!</b>
```

#### Valid placements
```jinja
<!-- Within text -->
Let's go <b>{{activity}}</b>!

<!-- Within attribute values -->
<b style="color:{{displayColor}}">
  Let's go running!
</b>

<!-- Completely surrounding elements or text -->
{{if maybe}}
  <b>Let's go dancing!</b>
{{/if}}
```

## Whitespace and comments

Before parsing, all HTML comments, leading and trailing whitespace, and new lines are removed from templates. This reduces page size, and it keeps template code more readable when spaces are not desired between inline elements. This cannot be disabled in development, since whitespace between inline elements is significant for rendering of text and inline or inline-block elements.

If you do want whitespace at the beginning or end or a line, add the non-standard `&sp;` character entity, which is replaced with a space. You can avoid whitespace minification for a view by specifying the `unminified` option.

```jinja
<Body:>
  <view is="person-data"></view>

<person-data: unminified>
  <script type="application/x-yaml">
    firstName: {{firstName}}
    lastName: {{lastName}}
  </script>
```

HTML comments are removed, except for those with square brackets immediately inside of them. This syntax is used by Internet Explorer's conditional comments. It can also be used to include comments for copyright notices or the like.

```jinja
<Body:>
  <!-- This comment is removed from the template output -->
  <!--[if IE]><p>This comment is not removed</p><![endif]-->
  <!--[Neither is this one]-->
```
