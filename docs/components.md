---
layout: default
title: Components
has_children: true
---

# Overview

Components are the building blocks of Derby applications. A component is a view associated with a controller class. The [view](../views) is implemented as a Derby template and the controller is implemented as a JavaScript [class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes) or [constructor function](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object-oriented_JS). Derby creates an instance of the controller class each time it renders the component view.


## Reuse and organization

Components are reusable UI pieces, similar to custom HTML elements. In addition, they are the recommended way to structure complex applications as modular parts with clear inputs and outputs. Each significant unit of UI functionality should be its own component.

Components can be rendered on the server and the client, so the same code can produce static HTML, server-rendered dynamic applications, and client-rendered applications.


## Encapsulation

Each component has a scoped model in its own namespace. Data or references to the component's parent are passed in via view attributes. If you're familiar with it, this structure is similar to the [Model-View-ViewModel (MVVM) pattern](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel)—a component's scoped model is a ViewModel.


## Tabs Example

### index.html
```derby
<Body:>
  <view is="tabs">
    <pane title="One">
      <p>Some stuff here</p>
    </pane>
    <pane title="Two">
      <p>More stuff</p>
    </pane>
  </view>
```

### tabs.html
```derby
<index: arrays="pane">
  <ul class="tabs-nav">
    {{each @pane as #pane, #i}}
      {{with #i === selectedIndex as #isActive}}
        <li class="{{if #isActive}}active{{/if}}">
          {{if #isActive}}
            <b>{{#pane.title}}</b>
          {{else}}
            <a on-click="select(#i)">{{#pane.title}}</a>
          {{/if}}
        </li>
      {{/with}}
    {{/each}}
  </ul>
  {{each @pane as #pane, #i}}
    <div class="tabs-pane {{if #i === selectedIndex}}active{{/if}}">{{#pane.content}}</div>
  {{/each}}
```

### tabs.js
```js
module.exports = Tabs;

function Tabs() {}
Tabs.view = __dirname + '/tabs.html';

Tabs.DataConstructor = function() {
  this.selectedIndex = 0;
};

Tabs.prototype.select = function(index) {
  this.model.set('selectedIndex', index);
};
```

### tabs.ts
```ts
const Component = require('derby').Component;

export = Tabs;

class TabsData {
  selectedIndex: number = 0;
}
class Tabs extends Component<TabsData> {
  static view = __dirname + '/tabs.html';
  static DataConstructor = TabsData;
  selectedIndex = this.model.at('selectedIndex');

  select(index: number): void {
    this.selectedIndex.set(index);
  }
}
```

### tabs.coffee
```coffee
module.exports = class Tabs
  @view: __dirname + '/tabs.html'

  @DataConstructor: ->
    @selectedIndex = 0

  select: (index) ->
    @model.set 'selectedIndex', index
```

<p class="codepen" data-height="200" data-theme-id="0" data-default-tab="result" data-user="nateps" data-slug-hash="MWWwYZK"></p>

(The above example uses [derby-standalone](https://github.com/derbyjs/derby-standalone), a client-side only build of Derby.)


## Todos example

```derby
<Body:>
  <view
    is="todos-new"
    on-submit="list.add()">
  </view>
  <view
    is="todos-list"
    as="list"
    items="{{_page.items}}">
  </view>
  {{if _page.items.length}}
    <view
      is="todos-footer"
      items="{{_page.items}}">
    </view>
  {{/if}}

<todos-new:>
  <form on-submit="submit()">
    <input type="text" value="{{value}}">
    <button type="submit">Add todo</button>
  </form>

<todos-list:>
  <ul class="todos-list">
    {{each items as #item, #i}}
      <li>
        <label class="{{if #item.done}}done{{/if}}">
          <input type="checkbox" checked="{{#item.done}}">
          {{#item.text}}
        </label>
        <button type="button" on-click="remove(#i)">Delete</button>
      </li>
    {{/each}}
  </ul>

<todos-footer:>
  <div class="footer">
    {{remaining(@items)}} items left
  </div>
```

```js
app.component('todos-new', class TodosNew {
  submit() {
    const value = this.model.del('value');
    this.emit('submit', value);
  }
});

app.component('todos-list', class TodosList {
  add(text) {
    if (!text) return;
    this.model.push('items', {text});
  }
  remove(index) {
    this.model.remove('items', index);
  }
});

app.component('todos-footer', class TodosFooter {
  static singleton = true;
  remaining(items) {
    if (!items) return 0;
    return items.filter(item => !item.done).length;
  }
});
```

<p class="codepen" data-height="350" data-theme-id="0" data-default-tab="result" data-user="nateps" data-slug-hash="oNNXRzq"></p>

<script async src="https://static.codepen.io/assets/embed/ei.js"></script>
