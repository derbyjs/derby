---
layout: default
---

# Derby

<p class="promo">MVC framework making it easy to write realtime, collaborative applications that run in both Node.js and browsers.</p>

<div class="javascript">
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

<div class="coffeescript">
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

### Why not use Rails and Backbone?

Derby represents a new breed of application frameworks, which we believe will replace currently popular libraries like [Rails](http://rubyonrails.org/) and [Backbone](http://documentcloud.github.com/backbone/).

Adding dynamic features to [Rails](http://rubyonrails.org/), [Django](https://www.djangoproject.com/), and other server-side apps tends to produce a tangled mess. Server code renders various initial states while jQuery selectors and callbacks desperately attempt to make sense of the DOM and user events. Adding new features typically involves changing both server and client code, often in different languages.

Many developers now include a client MVC framework like [Backbone](http://documentcloud.github.com/backbone/) to better structure client code. A few have started to use declarative model-view binding libraries, such as [Knockout](http://knockoutjs.com/) and [Angular](http://angularjs.org/), to reduce boilerplate DOM manipulation and event bindings. These are great concepts, and adding some structure certainly improves client code. However, they still lead to duplicating rendering code and manually synchronizing changes in increasingly complex server and client code bases. Not only that, each of these components must be manually wired together and packaged for the client.

Derby radically simplifies this process of adding dynamic interactions. It runs the same code in servers and browsers, and it syncs data automatically. Derby takes care of template rendering, packaging, and model-view bindings out of the box. Since all features are designed to work together, no code duplication and glue code are needed. Derby equips developers for a future when all data in all apps are realtime.

### Features

* **HTML templates:** [Mustache](http://mustache.github.com/mustache.5.html)-like templates are rendered into HTML on both the server and client. Because they render on the server, pages display immediately---even before any scripts are downloaded. Templates are mostly just HTML, so designers can understand and modify them.

* **View bindings:** In addition to HTML rendering, templates specify live bindings between the view and model. When model data change, the view updates the properties, text, or HTML neccessary to reflect the new data. When the user interacts with the page---such as editing the value of a text input---the model data are updated.

* **Client and server routing:** The same routes produce a single-page browser app and an [Express](http://expressjs.com/) server app. Links render instantly with push/pop state changes in modern browsers, while server rendering provides access to search engines and browsers without JavaScript.

* **Model syncing:** Model changes are automatically sychronized with the server and all clients subscribed to the same data over [Socket.IO](http://socket.io/).

* **Conflict resolution:** The server detects conflicts, enabling clients to respond instantly and work offline. Multiple powerful techniques for conflict resolution are included.

* **Customizable persistence:** Apps function fully with in-memory, dynamic models. After the design crystallizes and the logic is written, schemas can be added to provide validation and automatic persistence of data to one or more databases.

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

Typically, writing Derby apps begins with HTML templates.

## Templates

Derby compiles a collection of HTML-based templates into a page based on a number of pre-defined names. Pages usually define at least a `Title` and `Body` template. Templates may be created programatically via the `view.make()` method:

{% highlight javascript %}
var view = require('derby').createApp(module).view;

view.make('Body', '<h1>Howdy!</h1>');
{% endhighlight %}

{% highlight coffeescript %}
{view} = require('derby').createApp module

view.make 'Body', '<h1>Howdy!</h1>'
{% endhighlight %}

However, they are generally placed in template files within the `views` directory. Each app automatically looks for a template file that shares the same name and calls view.make for each template. Templates placed in a template file are also automatically bundled with the application scripts so that they can be rendered on the client.

Template files are also HTML, but each template is wrapped in a tag that names the template. This name must end in a colon to differentiate it from a normal HTML tag. These tags need not be closed. For example:

{% highlight html %}
<Title:>
  Silly example

<Body:>
  <h1>Howdy!</h1>
{% endhighlight %}

### Pre-defined templates

Note that template files don't contain boilerplate HTML, such as doctype definitions, stylesheets, and script includes. By default, Derby includes these items in an order optimized for fast load times.

Some templates have names that also are the names of HTML tags, but only `Title` wraps the template in a tag. Derby does *not* include any non-required HTML elements, such as `<html>`, `<head>`, and `<body>`. Browsers don't need them, and pages will still validate as proper HTML5.

By convention, Pre-defined template names are capitalized to indicate that the page renderer will include them by default. However, since HTML tags are case-insensitive, Derby template names are also case insensitive. Thus, `Body`, `BODY`, and `body` all represent the same template.

Derby sends a page in a number of chunks optimized for load time:

#### First chunk

1. **`Doctype:`** Standard HTML5 doctype and character set definition---`<!DOCTYPE html><meta charset=utf-8>`---unless overridden 
2. **`Title:`** "Derby app" unless overridden
3. **`Head:`** Optional location for meta tags, scripts that must be placed in the HTML `<head>`, and manually included stylesheets
4. CSS is compiled and inserted after the Head template automatically.
5. **`Header:`** Optional location for a page header that will be sent with the initial response chunk. Note that this is actually part of the HTML `<body>`, but it should render correctly by itself. It is separated out so that it can be displayed to the user before the rest of the page if the remainder of the page takes a while to download. Typically this includes static content, such as a logo and a top navigation bar.

#### Second chunk

6. **`Body:`** The page's content.

#### Third chunk

7. Inline scripts placed in a file named `inline.js` or added via the `view.inline()` method. Scripts are typically included this way if they are needed to properly render the page, such as resizing an element based on the window size.
8. **`Script:`** Optional location for external scripts loaded before the client scripts. This is where you would put a script tag to include jQuery, for example. Note that this template is just a location within the page, and it is not wrapped in a script tag.
9. Client scripts are automatically included via an asynchronously loaded external script. The name of the script is a hash of its content so that it can be cached by the browser long term.

#### Fourth chunk

10. JSON bundle of the model data, event bindings, and other data resulting from rendering the page. This bundle initializes the application once the external client script loads.
11. **`Tail:`** Optional location for additional scripts to be included at the very end of the page.

<style>
ol{counter-reset: item}
ol>li{display: block}
ol>li:before{content: counter(item) ". "; counter-increment: item}
#second_chunk+ol{counter-reset: item 5}
#third_chunk+ol{counter-reset: item 6}
#fourth_chunk+ol{counter-reset: item 9}
</style>

