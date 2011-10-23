---
layout: default
---

# Derby

<p class="promo">MVC framework for realtime, collaborative Node.js apps. Write HTML templates, routes, and application logic; Derby creates the realtime synchronized server and web app.</p>

<div class="js">
<h3>hello.js</h3>
{% highlight javascript %}
var hello = require('derby').createApp(module),
    view = hello.view,
    get = hello.get;

// Templates define both HTML and model <--> view bindings
view.make('Body',
  'Holler: <input value="((message))"><h1>((message))</h1>'
);

// Routes render on client as well as server
get('/', function (page, model) {
  // Subscribe specifies the data to sync
  model.subscribe('message', function () {
    page.render();
  });
});
{% endhighlight %}

<h3>server.js</h3>
{% highlight javascript %}
var express = require('express'),
    hello = require('./hello'),
    server = express.createServer()
      .use(express.static(__dirname + '/public'))
      // Apps create an Express middleware
      .use(hello.router()),

    // Apps also provide a server-side store for syncing data
    store = hello.createStore({ listen: server });

server.listen(3000);
{% endhighlight %}
</div>

<div class="coffee">
<h3>hello.coffee</h3>
{% highlight coffeescript %}
{view, get} = require('derby').createApp module

# Templates define both HTML and model <--> view bindings
view.make 'Body',
  'Holler: <input value="((message))"><h1>((message))</h1>'

# Routes render on client as well as server
get '/', (page, model) ->
  # Subscribe specifies the data to sync
  model.subscribe 'message', ->
    page.render()
{% endhighlight %}

<h3>server.coffee</h3>
{% highlight coffeescript %}
express = require 'express'
hello = require './hello'
server = express.createServer()
  .use(express.static __dirname + '/public')
  # Apps create an Express middleware
  .use(hello.router())

# Apps also provide a server-side store for syncing data
store = hello.createStore listen: server

server.listen 3000
{% endhighlight %}
</div>

## Instant by default

Derby apps are instant loading, instant updating, multi-user, and offline-capable by default. Here's how they work:

* **HTML templates**: Mustache-like templates are rendered into HTML on both the server and client. Because they render on the server, pages display immediately--even before any scripts are downloaded. Templates are mostly just HTML, so designers can understand and modify them.
* **Client and server routing**: The same routes produce a single-page browser app and a REST server app. Links render instantly with push/pop state changes in modern browsers, while server rendering provides access to search engines and browsers without JavaScript.
* **View bindings**: In addition to HTML rendering, templates specify live bindings between the view and model. When model data change, the view updates the properties, text, or HTML neccessary to reflect the new data. When the user interacts with the page--such as editing the value of a text input--the model data are updated.
* **Model syncing**: Model changes are automatically sychronized with the server and all clients subscribed to the same data.
* **Conflict resolution**: The server detects conflicts, enabling clients to respond instantly and work offline. Multiple powerful techniques for conflict resolution are included.
* **Customizable persistence**: Apps function fully with in-memory, dynamic models. After the design crystalizes and the logic is written, schemas can be added to provide validation and automatic persistence of data to one or more databases.

## Flexibility without the glue code

Derby eliminates the tedium of wiring together a server, server templating engine, CSS compiler, script packager, minifier, client MVC framework, client JavaScript library, client templating and/or bindings engine, client history library, realtime transport, ORM, and database. It elminates the complexity of keeping state synchronized among models and views, clients and servers, multiple windows, multiple users, and models and databases.

At the same time, it plays well with others. Derby is built on top of popular components, including Node.js, Express, Socket.IO, Share.js, Browserify, Stylus, Uglify, MongoDB, and soon other popular databases and datastores. Each of these components can be used directly. The data synchronization layer, which is called Racer, can be used separately. Other libraries, such as jQuery, work just as well along with Derby.

When following the default file structure, templates, styles, and scripts are automatically packaged and included in the appropriate pages. In addition, Derby can be used with a dynamic API, as seen in the simple example above.

