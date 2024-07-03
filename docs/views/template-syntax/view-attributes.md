---
layout: default
title: View attributes
parent: Template syntax
grand_parent: Views
---

# View attributes

A `<view>` element or `{{view}}` expression renders a view in a particular location. In other words, it creates a "view instance." The `is` attribute specifies the name of the view to render. If a view has been declared as a component with the `app.component()` method, a view instance instantiates a component as well.

In addition, to `is`, Derby treats the attributes `as`, `within`, `inherit`, `extend`, and attributes that begin with `on-` specially. These special attributes are described in below sections.

Other attribute names are custom to a view or component, and they are used to pass in data or options to a given view or component instance. We'll describe use of these custom attributes first.

## User-defined view attributes

Most view attributes are custom options particular to a view or component. They are analogous to the arguments of a function. They might provide data inputs, a two-way data binding, toggle options, or pass in a template.

### Basic attribute values

Attribute values can be any JavaScript expression supported by Derby.

[Literals](literals) are the simplest kinds of attribute values.

```jinja
<!-- As with HTML, values in quotes are passed in as strings -->
<view is="modal" title="Introducing"></view>

<!-- Following HTML convention, dashes should be used for multi-word attribute
names. Also like HTML, these become camelCased names when used in JavaScript
expressions that access these attribute values. -->
<view is="modal" color-scheme="dark"></view>

<!-- Numbers and literal types other than strings can be passed in using
literal expressions inside of double curlies. -->
<view is="modal" width="{{100}}"></view>

<!-- Following HTML convention, boolean attributes are those without a value.
When an attribute name with no value is written in a template, its value is
passed in as `true`. -->
<view is="modal" has-backdrop></view>

<!-- Sets a literal string value for the `content` attribute -->
<view is="modal">Hello, World.</view>
```

Other types of expressions are supported too, such as path expressions, expressions with operators, or a function expressions.

```jinja
<!-- Passing in a path to a model value with a path expression -->
<view is="modal" title="{{modalTitle}}"></view>

<!-- Square bracket expression -->
<view is="modal" color-scheme="{{userConfigurations[userId].colorScheme}}"></view>

<!-- Operator expression -->
<view is="modal" width="{{maxWidth - 200}}"></view>

<!-- Complex expression -->
<view is="modal" has-backdrop="{{forceBackdrop ? true : backdropForUser(userId)}}"></view>

<!-- Path expression for the `content` attribute -->
<view is="modal">{{modalBody}}</view>
```

### HTML templates as attribute values

Finally, an attribute value may be a template.

```jinja
<!-- If an attribute contains more than a single expression, it becomes a
template. Template blocks, such as {{if}} and {{each}} are supported, too. -->
<view is="modal" title="Introducing, {{modalTitle}}">

<!-- HTML templates can be passed in with the `content` attribute -->
<view is="modal">
  <view is="greeting"></view>, <i>World</i>.
</view>
```

Derby's ability to pass in templates as attribute values is very powerful and can be highly expressive. By default, any template content between the opening and closing `<view>` tags is passed in as an attribute with the name `content`. However, a view instance may wish to specify an HTML template for another attribute as well. In these cases, an `<attribute>` tag may be used immediately within a view instance.

```jinja
<view is="modal">
  <!-- Alternate syntax for passing in attribute values. This syntax allows for
  passing in HTML tags as part of templates as well. -->
  <attribute is="title">Introducing, <b>{{modalTitle}}</b></attribute>
  <!-- All remaining content continues to specify the `content` attribute -->
  <view is="greeting"></view>, <i>World</i>.
</view>
```

Beyond individual attribute values, it is common to want to pass in a list of items. This can be achieved with an array attribute. `<array>` tags produce an array of objects, where each HTML tag corresponds to an object in an array.

```jinja
<view is="tabs">
  <!-- Creates a single attribute `panes`, which has the value:
  [{title: 'First tab', content: 'Hello!'},
  {title: 'Second tab', content: 'Greetings.'}] -->
  <array is="panes" title="First tab">Hello!</array>
  <array is="panes" title="Second tab">Greetings.</array>
</view>
```

### Custom attribute tags

To make instantiating commonly used components more elegant, Derby supports the ability to declare a custom tag name that refers to a view as well as the attributes and array attributes that a view supports.

Definition:

```jinja
<!-- attributes and arrays can be declared in space separated lists -->
<!-- arrays can specify a singular and plural name separated by a slash -->
<tabs: tag="tabs" attributes="selectedIndex size" arrays="pane/panes">
  <ul class="tabs size-{{@size || 'medium'}}">
    {{each @panes as #pane, #i}}
      <li class="{{if @selectedIndex === #i}}selected{{/if}}">{{#pane.title}}</li>
    {{/each}}
  </ul>
  {{@panes[@selectedIndex].content}}
```

Usage:

```jinja
<tabs selected-index="{{currentTab}}" panes="{{paneOptions}}"></tabs>

<tabs>
  <selected-index>{{0}}</selected-index>
  <pane title="First tab">Hello!</pane>
  <pane title="Second tab">Greetings.</pane>
</tabs>
```

## Special Derby attributes

### `within` attributes

When passing values into attributes with expressions or templates, names are contextual to the location where the view is instantiated. This, too, is similar to how arguments are passed into functions: When calling a function, the name of the variable being passed in is whatever that name means at the location of the function call, not what the name means inside of the function. Inside of the function itself, the name could mean something different or be undefined.

Adding `within` changes this. Rather than using the meaning of the name where the view is instantiated, Derby will use the meaning of the name wherever the attribute is ultimately rendered.

This is a powerful feature for defining a component or view that has a general capability, such as a list that can be manually sorted with drag-and-drop. Then, instances can pass in a template that is rendered within that list as if it was defined there.

Any attribute may be declared as `within`. Adding `within` to a view tag affect's the view's `content` attribute. To specify other attributes as within, use the expanded `<attribute>` or `<array>` form of passing in an attribute.

Definition:

```jinja
<dropdown: arrays="option/options">
  <ul>
    {{each @options as #option, #i}}
      <li>{{@content}}</li>
    {{/each}}
  </ul>
```

Usage:

```jinja
<!-- A within content attribute -->
<view is="dropdown" options="{{dropdownOptions}}" within>
  <!-- Notice use of alias names defined only inside of the view -->
  {{#i + 1}}. {{#option.text}}
</view>
```

Within attributes are always passed in as Template objects, even if they contain only a single expression (see following section). This is because the meaning of the paths in the expression may change depending on the context in which the attribute is ultimately used. Therefore, passing a `within` attribute into a component will always set a Template object on the component's model.

If a `within` attribute is passed to a component, the component's `getAttribute()` method will return the meaning of the attribute as if it were rendered immediately inside of the component's main view. Thus, model paths will refer to model paths within the component.

### `as` attribute

The `as` attribute may be applied to both components and DOM elements. Before a component's `create` method is called, Derby will set these items as properties of the current controller. This provides easy access to these items within the controller code of a component.

```jinja
<index:>
  <div as="container">
    <view is="modal" as="modal"></view>
  </div>
```

```js
// DOM element
this.container.querySelectorAll('*');
// component
this.modal.close();
```


### `as-array` attribute

Similar to the `as` attribute, a property with the provided name is made available on the component, but in this case the value is an array of multiple references. This is useful in an `each` block, to provide a reference in the controller to every individual item.

```jinja
{{each items as #item, #index}}
  <input as-array="itemEditor">{{#item}}</input>
{{/each}}
```

```js
this.itemEditor[index]; // references the Component or DOM element for item at `index`
```

### `as-object` attribute

Similar to the `as-array` attribute, a property with the provided name is made available on the component, but with the value being a map-like object. The second argument to `as-object` specifies the key for each entry.

```jinja
<ul>
  {{each _page.items as #item}}
    <li as-object="listItems, #item.id">{{#item.name}}
  {{/each}}
</ul>v
```

```js
this.page.model.set('_page.items', [
  {id: 'a', name: 'Item A'},
  {id: 'b', name: 'Item B'},
]);

this.listItems.a // references the Component or DOM element for "Item A"
```

### `inherit` attribute

Adding the `inherit` attribute changes the behavior of attribute lookup within the instantiated view. By default, attribute values are only defined in the view that they are passed into explicitly. Passing attribute values through one view into another normally requires manually repeating the attributes, such as `class="{{@class}}"`. `inherit` modifies the default behavior, making all attributes of the parent view instance implicitly available as well. Explicitly providing an attribute will take precedence over `inherit`.

```jinja
<index:>
  {{@foo}}
  <view is="modal" inherit></view>

<modal:>
  {{@foo}}
```

### `extend` attribute

Extend is used to render the view of a component **without** instantiating the component object that would normally be created. It can be useful if one component class would like to extend from the class of another component, and it does not wish to modify the component's view.

### `on-` attributes

View attributes beginning with `on-` attach event listeners to component events. See [Component Events](../../components/events).

## Relation of view attributes to a component's model

View attributes are the primary way to pass values into a component's model. Right before Derby calls a component's `init` method, it gets the current value for each view attribute and sets it on the component's model with the same name. Therefore, inside of a component, the model path can be used to access the value of the attribute.

How an attribute value is set on the model differs depending on the value type. The guidelines for Derby's approach are:

* When model values coming from attributes are used within the component's view template, they should render what an attribute path of the same name would be able to render. This means, for example, that templates which return HTML elements cannot be set on the model as strings of HTML. Instead, they are set on the model as Template objects
* Attributes are both an input and an output (two-way bound) when possible
* The type of the value passed in should be as intuitive and predictable to developers as possible
* Special syntax should be kept to a minimum. This is both to make templates easier to read and to make template authoring and editing more widely accessible to team members with HTML experience but little programming experience

Keeping these goals in mind, Derby will set values on a component model with one of four approaches:

**1. Literal Value – Input**
```jinja
value="Hello"
value="{{42}}"
<attribute is="message">Hello</attribute>
```

**2. Model Reference – Input and Output**
```jinja
value="{{inputText}}"
value="{{todos[#id].text}}"
```

**3. Value with Attribute Binding – Input (for now)**
```jinja
disabled="{{!active}}"
label="{{userLabel || 'User'}}"
list="{{reverse(items)}}"
options="{{ {speed: currentSpeed} }}"
```

**4. Template – Input**
```jinja
class="{{if show}}visible{{/if}}"
<attribute is="message"><b>Hello</b></attribute>
```

In all cases, the value inside the component model is updated to remain consistent with any dynamic inputs. Literal Values and Templates are set on the component model initially only. Literal Values will not change, and paths within Template objects are bound when they are later used somewhere inside the component's view. For attributes containing a single expression and no additional text or templating features, Derby either creates a Model Reference or an Attribute Binding. In both cases, the current value of the expression is set initially. In addition, when data changes for paths within the expression, the model value is updated.

Derby creates a Model Reference (`model.ref()`) for attribute expressions where possible. Model References reflect changes in both directions, so this establishes a two-way binding. The expressions that can be represented with Model References are the ones that can be resolved to an equivalent path in the model: specific path expressions, aliases and attributes that refer to specific paths, and square bracket expressions.

 Any dynamic expression that cannot be resolved to an equivalent model path, such as an expression using a function, an operator, or an array or object literal, establishes a Component Attribute Binding. Currently, these are only implemented as one-way input bindings—the value of such an expression is set initially, and as its dependencies change, the value is recomputed and set on the component's model again. It is worth mentioning that function expressions and some operators define both a `get` and a `set` function, enabling them to be used in two-way bindings. For example, the `!` (not) operator supports a `set` function. These two-way function and operator bindings are supported by Derby's HTML element bindings, such as `<input type="checkbox" checked="{{!incomplete}}">`. However, component attributes do not support use of `set` functions yet. Therefore, two-way bindings like `<view is="checkbox" value="{{!incomplete}}"></view>` do not work currently. (They do work without the `!`, assuming Derby is able to make a Model Reference.)
