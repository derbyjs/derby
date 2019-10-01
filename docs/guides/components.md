# Components

Derby components are views associated with a controller. The controller is a JavaScript object that is created whenever an instance of the view is rendered.

Components enable creating reusable UI pieces, similar to creating custom HTML elements. In addition, they are the recommended way to break up complex applications into modular parts. It's helpful to break up application features into components, even if only used in a single place.

Each component has a scoped model in its own namespace. Data or references to the containing model are passed in via view attributes. This structure is similar to the Model View ViewModel (MVVM) pattern, where a component's scoped model is essentially a ViewModel.

## Tabs Example

```
<Body:>
  <tabs>
    <pane title="One">
      <p>Some stuff here</p>
    </pane>
    <pane title="Two">
      <p>More stuff</p>
    </pane>
  </tabs>
```

```
// Use component published as module
app.component(require('d-tabs'));

// Associate component with view already registered in app
app.component('tabs', require('./tabs'));
```

### tabs.html
```
<tabs: arrays="pane" tag="tabs">
  <ul class="tabs-nav">
    {{each @pane as #pane, #i}}
      <li class="{{if selectedIndex === #i}}active{{/if}}">
        <a on-click="select(#i)">{{#pane.title}}</a>
      </li>
    {{/each}}
  </ul>
  {{each @pane as #pane, #i}}
    <div class="tabs-pane{{if selectedIndex === #i}} active{{/if}}">
      {{#pane.content}}
    </div>
  {{/each}}
```

### tabs.styl
```
.tabs-nav
  list-style: none
  >li
    display: inline-block
.tabs-pane
  display: none
  &.active
    display: block
```

### tabs.js
```
module.exports = Tabs;

function Tabs() {}
Tabs.prototype.view = __dirname + '/tabs.html';

Tabs.prototype.init = function(model) {
  model.setNull('selectedIndex', 0);
}

Tabs.prototype.select = function(pane, e) {
  this.model.set('currentPane', pane);
};
```

### tabs.coffee
```
module.exports = class Tabs
  view: __dirname + '/tabs.html'

  init: (model) ->
    model.setNull 'selectedIndex', 0

  select: (pane, e) ->
    @model.set 'currentPane', pane
```

## Todos example

```
<Body:>
  <view
    is="todos-new"
    on-submit="list.add()"
    label="Add todo"
    autofocus>
  </view>
  <view
    is="todos-list"
    as="list"
    items="{{_page.items}}">
  </view>

<todos-new:>
  <form on-submit="submit()">
    <input type="text" value="{{value}}" placeholder="{{@placeholder}}" autofocus="{{@autofocus}}">
    <button type="submit">{{@label}}</button>
  </form>

<todos-list:>
  <ul>
    {{each @items as #item, #i}}
      <li>
        <input type="checkbox" checked="{{#item.checked}}">
        {{#item.text}}
        <button type="button" on-click="remove(#i)">Delete</button>
      </li>
    {{/each}}
  </ul>
```

```
app.component 'todos-new', class TodosNew
  submit: ->
    value = @model.del 'value'
    @emit 'submit', value

app.component 'todos-list', class TodosList
  add: (text) ->
    @model.push 'list', {text}
  remove: (index) ->
    @model.remove 'list', index
```
