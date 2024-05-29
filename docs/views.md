---
layout: default
title: Views
has_children: true
---

# Views

When writing an app or new feature in Derby, you should typically start by writing its view. Derby templates can be written in HTML or Jade with [derby-jade](https://github.com/derbyparty/derby-jade). Templates define HTML/DOM output, data bindings, event listeners, and component parameters.

## Creating views

Views are written in HTML files. These files are parsed and added to a Derby app with the `app.loadViews()` method. This method synchronously reads template files, traverses their includes, and calls `app.views.register()` for each view.

> `app.loadViews(filename)`
> * `filename` File path to root template file at which to start loading views

> `app.views.register(name, source, options)`
> * `name` View name to add
> * `source` Derby HTML source
> * `options:`
>   * `tag` Name of an HTML tag that will render this view
>   * `attributes` Space separated list of HTML tags interpreted as an attribute when directly within the view instance
>   * `arrays` Space separated list of HTML tags interpreted as an array of objects attribute when directly within the view instance
>   * `unminified` Whitespace is removed from templates by default. Set true to disable
>   * `string` True if the template should be interpreted as a string instead of HTML

> `view = app.views.find(name, [namespace])`
> * `name` View name to find
> * `namespace` *(optional)* Namespace from which to start the name lookup
> * `view` Returns the view template object

Each view is wrapped in a tag that names it. This name must end in a colon to differentiate it from a normal HTML tag. These tags can't be nested, and they need not be closed.

```jinja
<serious-title:>
  <h1>Hello, sir.</h1>

<friendly-title:>
  <h1>Howdy!</h1>
```

is equivalent to:

```js
app.views.register('serious-title', '<h1>Hello, sir.</h1>');
app.views.register('friendly-title', '<h1>Howdy!</h1>');
```

## Using views

You can instantiate a view in a template with the `<view>` tag, `{{view}}` expression, or by giving the view a tag name. Typically, you should use the `<view>` tag in HTML templates. The `{{view}}` expression is useful when writing string templates or wish to include a view in an HTML attribute, script tag, or style tag. Custom tag names are global to an application. They are recommended for general purpose components, like `<tabs>` or `<dropdown>`, but not for ordinary views.

```jinja
<serious-title: tag="seriousness">
  <h1>Hello, sir.</h1>

<Body:>
  <!-- Recommended form -->
  <view is="serious-title"></view>
  <!-- Self-closing tag syntax is also supported -->
  <view is="serious-title" />
  <!-- Expression form is used for non-HTML templates -->
  {{view 'serious-title'}}
  <!-- Custom tags may be defined for views -->
  <seriousness></seriousness>
  <seriousness />
```

Views may be looked up dynamically with an expression. If the view isn't found, nothing will be rendered.

```jinja
<Body:>
  <!-- Dynamic view lookup based on an expression -->
  <view is="{{type}}-title"></view>
  {{view type + '-title'}}
```
