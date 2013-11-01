# Components

Components are views with self-contained JavaScript functionality. They enable creating reusable UI pieces, similar to creating custom HTML elements. In addition, they are the recommended way to break up complex applications into modular parts. It's helpful to break up application features into components, even if only used in a single place.

Each component has a scoped model in its own namespace. Data or references to the containing model are passed in via view attributes. This structure is similar to the Model View ModelView (MVVM) pattern, where a component's scoped model is essentially a ViewModel.

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
<tabs: arrays="pane" element="tabs">
  <ul class="tabs-nav">
    {{each @pane}}
      <li class="{{if selectedIndex === $index}}active{{/if}}">
        <a on="click: select($index)">{{this.title}}</a>
      </li>
    {{/each}}
  </ul>
  {{each @pane}}
    <div class="tabs-pane{{if selectedIndex === $index}} active{{/if}}">
      {{this.content}}
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
Tabs.prototype.style = __dirname + '/tabs.styl';

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
  style: __dirname + '/tabs.styl'

  init: (model) ->
    model.setNull 'selectedIndex', 0

  select: (pane, e) ->
    @model.set 'currentPane', pane
```

## Todos example

```
<Body:>
  <view
    name="todos-new"
    on="submit: list.add()"
    label="Add todo"
    autofocus>
  </view>
  <view
    name="todos-list"
    as="list"
    items="{{_page.items}}">
  </view>

<todos-new:>
  <form on="submit: submit()">
    <input type="text" value="{{value}}" placeholder="{{@placeholder}}" autofocus="{{@autofocus}}">
    <button type="submit">{{@label}}</button>
  </form>

<todos-list:>
  <ul>
    {{each @items as #item}}
      <li>
        <input type="checkbox" checked="{{#item.checked}}">
        {{#item.text}}
        <button type="button" on="click: remove($index)">Delete</button>
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
