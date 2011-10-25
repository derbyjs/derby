---
layout: default
---

# Derby

<p class="promo">MVC framework making it easy to write realtime, collaborative applications that run in both Node.js and browsers.</p>

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

## Introduction

Derby includes a powerful data synchronization engine called [Racer](http://racerjs.com/) that automatically syncs data between browsers, servers, and a database. Models subscribe to changes on specific objects, enabling granular control of data propagation without defining channels. Racer supports offline usage and conflict resolution out of the box, which greatly simplifies writing multi-user applications.

Derby applications load immediately and can be indexed by search engines, because the same templates render on both server and client. In addition, templates define bindings, which instantly update the view when the model changes and vice versa. Derby makes it simple to write applications that load as fast as a search engine, are as interactive as a document editor, and work offline.

### Features

* **HTML templates**: [Mustache](http://mustache.github.com/mustache.5.html)-like templates are rendered into HTML on both the server and client. Because they render on the server, pages display immediately---even before any scripts are downloaded. Templates are mostly just HTML, so designers can understand and modify them.

* **View bindings**: In addition to HTML rendering, templates specify live bindings between the view and model. When model data change, the view updates the properties, text, or HTML neccessary to reflect the new data. When the user interacts with the page---such as editing the value of a text input---the model data are updated.

* **Client and server routing**: The same routes produce a single-page browser app and an [Express](http://expressjs.com/) server app. Links render instantly with push/pop state changes in modern browsers, while server rendering provides access to search engines and browsers without JavaScript.

* **Model syncing**: Model changes are automatically sychronized with the server and all clients subscribed to the same data over [Socket.IO](http://socket.io/).

* **Conflict resolution**: The server detects conflicts, enabling clients to respond instantly and work offline. Multiple powerful techniques for conflict resolution are included.

* **Customizable persistence**: Apps function fully with in-memory, dynamic models. After the design crystalizes and the logic is written, schemas can be added to provide validation and automatic persistence of data to one or more databases.

### Why not use Rails and Backbone?

Derby represents a new breed of application frameworks, which we believe will replace currently popular libraries like Rails and Backbone.

Adding dynamic features to Rails, Django, and other server-side apps tends to produce a tangled mess. Server code renders various initial states while jQuery selectors and callbacks desperately attempt to make sense of the DOM and user events. Adding new features typically involves changing both server and client code, often in different languages.

Many developers now include a client MVC framework like Backbone to better structure client code. A few have started to use declarative model-view binding libraries, such as Knockout and Angular, to reduce boilerplate DOM manipulation and event bindings. These are great concepts, and adding some structure certainly improves client code. However, they still lead to duplicating rendering code and manually synchronizing changes in increasingly complex server and client code bases. Not only that, each of these components must be manually wired together and packaged for the client.

Derby radically simplifies this process of adding dynamic interactions. It runs the same code in servers and browsers, and it syncs data automatically. Derby takes care of template rendering, packaging, and model-view bindings out of the box. Since all features are designed to work together, no code duplication and glue code are needed. Derby equips developers for a future when all data in all apps are realtime.

### Flexibility without the glue code

Derby eliminates the tedium of wiring together a server, server templating engine, CSS compiler, script packager, minifier, client MVC framework, client JavaScript library, client templating and/or bindings engine, client history library, realtime transport, ORM, and database. It elminates the complexity of keeping state synchronized among models and views, clients and servers, multiple windows, multiple users, and models and databases.

At the same time, it plays well with others. Derby is built on top of popular components, including [Node.js](http://nodejs.org/), [Express](http://expressjs.com/), [Socket.IO](http://socket.io/), [Browserify](https://github.com/substack/node-browserify), [Stylus](http://learnboost.github.com/stylus/docs/iteration.html), [UglifyJS](https://github.com/mishoo/UglifyJS), [MongoDB](http://www.mongodb.org/), and soon other popular databases and datastores. These components can also be used directly. The data synchronization layer, [Racer](http://racerjs.com/), can be used separately. Other libraries, such as jQuery, work just as well along with Derby.

When following the default file structure, templates, styles, and scripts are automatically packaged and included in the appropriate pages. In addition, Derby can be used via a dynamic API, as seen in the simple example above.

# Getting started

As with all Node.js modules, first install [Node](https://github.com/joyent/node/wiki/Installation) and [npm](http://npmjs.org/).

Instal Derby with:

    $ npm install -g derby

Derby requires [Redis 2.2-scripting](https://github.com/antirez/redis/tree/2.2-scripting). Derby's models are powered by [Racer](http://racerjs.com/), which uses Redis to store data transactions and manage PubSub. Racer uses Redis Lua scripting, which [will be included](http://antirez.com/post/everything-about-redis-24) in the next stable release, Redis 2.6.

Download, extract, and compile Redis 2.2-scripting:

    $ curl -O http://redis.googlecode.com/files/redis-2.2.111-scripting.tar.gz
    $ tar xzf redis-2.2.111-scripting.tar.gz
    $ cd redis-2.2.111-scripting
    $ make

Then start the Redis server:

    $ src/redis-server

If you prefer to use [CoffeeScript](http://jashkenas.github.com/coffee-script/), make sure the compiler is installed:

    $ npm install -g coffee-script

## Create an app

Derby includes a simple project generator:

    $ cd ~
    $ derby new first_project
    $ cd first_project

or, for CoffeeScript:

    $ cd ~
    $ derby new --coffee first_project
    $ cd first_project
    $ make

`make` will execute the coffee compiler with the watch option, so leave it running in a separate terminal.

Make sure Redis is running, and fire up Node:

    $ node server.js
    $ open http://localhost:3000/

## File structure

The default file structure is:

    /public
      /img
      /gen
    /lib
      /app
        index.js
      /server
        index.js
    /styles
      /app
        index.styl
      404.styl
      reset.styl
    /views
      /app
        index.html
      404.html
    package.json
    server.js

In CoffeeScript projects, the `lib` directory is generated by the compiler, and script files should be edited in the `src` directory instead.

Derby uses a file naming convention similar to Node.js modules. Script, style, and html template files are all identified by filename. As in Node.js, a file named `app.js` and a directory `app` containing a file `index.js` are equivalent. The same applies for styles and views, which can either be `app.styl` or `app\index.styl` and `app.html` or `app\index.html`.

Apps are associated with their respective styles and views by filename only. The app filename also becomes the name of the global variable that the application exposes in the browser. Therefore, app names should be valid JavaScript variable names, starting with a letter and containing only alphanumeric characters and underscores.

Static files are placed in the public folder. Derby compiles scripts for the browser into the `public\gen` folder. Styles and templates are included in pages automatically by Derby. They both support includes, so shared styles and templates may be defined in separate files.

# Views

