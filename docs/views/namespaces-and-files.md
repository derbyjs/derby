---
layout: default
title: Namespaces and files
parent: Views
---

# View namespaces

View names have colon (`:`) separated namespaces. Lookups of views are relative to the namespace in which they are used. Thus, sub-views within components or different sections of large applications are well encapsulated and won't cause naming conflicts.

```jinja
<home:content:>
  ...

<about:content:>
  ...

<about:Body:>
  <!-- Outputs content for the about page -->
  <view is="content"></view>
```

In addition, similar to the way that CSS allows overriding of styles by using a more specific selector, you can define views at a general namespace and then redefine them at a more specific namespace.

```jinja
<Title:>
  App

<about:Title:>
  About - App

<about:mission:Title:>
  Mission statement - App
```

### Custom HTML tags

A view can be turned into a custom HTML tag by specifying the `tag` property in it's definition. Custom tag names are global so care should be taken in their usage.

```jinja
<!-- definition -->
<message: tag="message">
  <div> {{data}} </div>

<!-- usage: render two messages with different data -->
<message data="{{foo}}"></message>
<message data="{{bar}}"></message>
```

## Structuring views in multiple files

Views should be broken into files that correspond to major pieces of functionality, different URLs, or components. Views are included from another file with the `<import:>` tag.

```jinja
<!-- add views from about.html or about/index.html to the `about` namespace -->
<import: src="./about">

<!-- override the namespace to `about-us` -->
<import: src="./about" ns="about-us">

<!-- import into the current namespace -->
<import: src="./about" ns="">
```

Typically, view namespaces have a one-to-one correspondence with directories and files. For example, a typical structure like:

#### index.html
```jinja
<import: src="./about">

<Title:>
  App
```

#### about/index.html
```jinja
<import: src="./mission">

<Title:>
  About - App
```

#### about/mission.html
```jinja
<Title:>
  Mission statement - App
```

would be equivalent to:

`index.html`
```jinja
<Title:>
  App

<about:Title:>
  About - App

<about:mission:Title:>
  Mission statement - App
```

Rules for importing views work the same way as [Node.js module loading](https://nodejs.org/api/modules.html) with `require()`. The `src` attribute uses the same syntax of relative paths or paths to `node_modules`. An `index.html` file can be imported via the name of the directory that it is in, just like `index.js` files in Node.js.

As well, the name `index` can be used for a view that is returned for just the name of its namespace.

#### index.html
```jinja
<import: src="./home">

<Body:>
  <view is="home"></view>
```

#### home.html
```jinja
<index:>
  <h1>
    <view is="message"></view>
  </h1>

<message:>
  Hello!
```
