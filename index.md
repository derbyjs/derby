---
layout: default
version: 0.1.10
headers:
  - text: Introduction
    type: h1
  - text: Why not use Rails and Backbone?
    type: h2
  - text: Features
    type: h2
  - text: Flexibility without the glue code
    type: h2
  - text: Demos
    type: h2
  - text: Getting started
    type: h1
  - text: Create an app
    type: h2
  - text: File structure
    type: h2
  - text: Apps and static pages
    type: h1
  - text: Creating apps
    type: h2
  - text: Connecting servers to apps
    type: h2
  - text: Static pages
    type: h2
  - text: Views
    type: h1
  - text: Creating templates
    type: h2
  - text: Pre-defined templates
    type: h3
  - text: Importing templates
    type: h3
  - text: Template syntax
    type: h2
  - text: Whitespace and HTML conformance
    type: h3
  - text: Variables
    type: h3
  - text: Sections
    type: h3
  - text: Partials
    type: h3
  - text: Bindings
    type: h3
  - text: Relative model paths and aliases
    type: h3
  - text: HTML extensions
    type: h2
  - text: DOM event binding
    type: h3
  - text: Boolean attributes
    type: h3
  - text: Form elements
    type: h3
  - text: Performance
    type: h2
  - text: Stylesheets
    type: h2
  - text: Rendering
    type: h2
  - text: app.view
    type: h2
  - text: Controllers
    type: h1
  - text: Routes
    type: h2
  - text: History
    type: h3
  - text: User events
    type: h2
  - text: Model events
    type: h2
  - text: Application logic
    type: h2
  - text: Models
    type: h1
  - text: Introduction to Racer
    type: h2
  - text: STM and OT
    type: h3
  - text: Creating stores
    type: h2
  - text: Configuration options
    type: h3
  - text: Creating models
    type: h2
  - text: Model features
    type: h2
  - text: Paths
    type: h3
  - text: Subscription
    type: h3
  - text: Scoped models
    type: h3
  - text: Mutators
    type: h3
  - text: Events
    type: h3
  - text: Reactive functions
    type: h3
  - text: References
    type: h3
---

# Derby

<p class="promo">MVC framework making it easy to write realtime, collaborative applications that run in both Node.js and browsers.</p>

<h3 class="javascript">hello.js</h3>
{% highlight javascript %}
var hello = require('derby').createApp(module)
  , view = hello.view
  , get = hello.get

// Templates define both HTML and model <- -> view bindings
view.make('Body'
, 'Holler: <input value="((message))"><h1>((message))</h1>'
)

// Routes render on client as well as server
get('/', function(page, model) {
  // Subscribe specifies the data to sync
  model.subscribe('message', function() {
    page.render()
  })
})
{% endhighlight %}

<h3 class="javascript">server.js</h3>
{% highlight javascript %}
var express = require('express')
  , hello = require('./hello')
  , server = express.createServer()
      .use(express.static(__dirname + '/public'))
      // Apps create an Express middleware
      .use(hello.router())

// Apps also provide a server-side store for syncing data
hello.createStore({ listen: server })

server.listen(3000)
{% endhighlight %}

<h3 class="coffeescript">hello.coffee</h3>
{% highlight coffeescript %}
{view, get} = require('derby').createApp module

# Templates define both HTML and model <- -> view bindings
view.make 'Body',
  'Holler: <input value="((message))"><h1>((message))</h1>'

# Routes render on client as well as server
get '/', (page, model) ->
  # Subscribe specifies the data to sync
  model.subscribe 'message', ->
    page.render()
{% endhighlight %}

<h3 class="coffeescript">server.coffee</h3>
{% highlight coffeescript %}
express = require 'express'
hello = require './hello'
server = express.createServer()
  .use(express.static __dirname + '/public')
  # Apps create an Express middleware
  .use(hello.router())

# Apps also provide a server-side store for syncing data
hello.createStore listen: server

server.listen 3000
{% endhighlight %}

### Add water and...

<iframe src="http://hello.derbyjs.com/" id="hello-iframe" seamless="seamless"> </iframe>

# Introduction

Derby includes a powerful data synchronization engine called [Racer](http://racerjs.com/). While it works differently, Racer is to Derby somewhat like ActiveRecord is to Rails. Racer automatically syncs data between browsers, servers, and a database. Models subscribe to changes on specific objects, enabling granular control of data propagation without defining channels. Racer supports offline usage and conflict resolution out of the box, which greatly simplifies writing multi-user applications.

Derby applications load immediately and can be indexed by search engines, because the same templates render on both server and client. In addition, templates define bindings, which instantly update the view when the model changes and vice versa. Derby makes it simple to write applications that load as fast as a search engine, are as interactive as a document editor, and work offline.

## Why not use Rails and Backbone?

Derby represents a new breed of application frameworks, which we believe will replace currently popular libraries like [Rails](http://rubyonrails.org/) and [Backbone](http://documentcloud.github.com/backbone/).

Adding dynamic features to apps written with [Rails](http://rubyonrails.org/), [Django](https://www.djangoproject.com/), and other server-side frameworks tends to produce a tangled mess. Server code renders various initial states while jQuery selectors and callbacks desperately attempt to make sense of the DOM and user events. Adding new features typically involves changing both server and client code, often in different languages.

Many developers now include a client MVC framework like [Backbone](http://documentcloud.github.com/backbone/) to better structure client code. A few have started to use declarative model-view binding libraries, such as [Knockout](http://knockoutjs.com/) and [Angular](http://angularjs.org/), to reduce boilerplate DOM manipulation and event bindings. These are great concepts, and adding some structure certainly improves client code. However, they still lead to duplicating rendering code and manually synchronizing changes in increasingly complex server and client code bases. Not only that, each of these components must be manually wired together and packaged for the client.

Derby radically simplifies this process of adding dynamic interactions. It runs the same code in servers and browsers, and it syncs data automatically. Derby takes care of template rendering, packaging, and model-view bindings out of the box. Since all features are designed to work together, no code duplication and glue code are needed. Derby equips developers for a future when all data in all apps are realtime.

## Features

* **HTML templates:** [Handlebars](http://handlebarsjs.com/)-like templates are rendered into HTML on both the server and client. Because they render on the server, pages display immediately---even before any scripts are downloaded. Templates are mostly just HTML, so designers can understand and modify them.

* **View bindings:** In addition to HTML rendering, templates specify live bindings between the view and model. When model data change, the view updates the properties, text, or HTML neccessary to reflect the new data. When the user interacts with the page---such as editing the value of a text input---the model data are updated.

* **Client and server routing:** The same routes produce a single-page browser app and an [Express](http://expressjs.com/) server app. Links render instantly with push/pop state changes in modern browsers, while server rendering provides access to search engines and browsers without JavaScript.

* **Model syncing:** Model changes are automatically sychronized with the server and all clients subscribed to the same data over [Socket.IO](http://socket.io/).

* **Conflict resolution:** The server detects conflicts, enabling clients to respond instantly and work offline. Multiple powerful techniques for conflict resolution are included.

* **Customizable persistence:** Apps function fully with in-memory, dynamic models. After the design crystallizes and the logic is written, adding automatic persistence of data to one or more databases is simple to add.

## Flexibility without the glue code

Derby eliminates the tedium of wiring together a server, server templating engine, CSS compiler, script packager, minifier, client MVC framework, client JavaScript library, client templating and/or bindings engine, client history library, realtime transport, ORM, and database. It elminates the complexity of keeping state synchronized among models and views, clients and servers, multiple windows, multiple users, and models and databases.

At the same time, it plays well with others. Derby is built on top of popular components, including [Node.js](http://nodejs.org/), [Express](http://expressjs.com/), [Socket.IO](http://socket.io/), [Browserify](https://github.com/substack/node-browserify), [Stylus](http://learnboost.github.com/stylus/docs/iteration.html), [UglifyJS](https://github.com/mishoo/UglifyJS), [MongoDB](http://www.mongodb.org/), and soon other popular databases and datastores. These components can also be used directly. The data synchronization layer, [Racer](http://racerjs.com/), can be used separately. Other libraries, such as jQuery, work just as well along with Derby.

When following the default file structure, templates, styles, and scripts are automatically packaged and included in the appropriate pages. In addition, Derby can be used via a dynamic API, as seen in the simple example above.

## Demos

[Source for the demos](https://github.com/codeparty/derby/tree/master/examples) is included with Derby.

### Chat

[http://chat.derbyjs.com/lobby](http://chat.derbyjs.com/lobby)

A simple chat demo. Note that as you edit your name, it updates in realtime. Name changes also show up in the page title and other rooms. Check out the source in the examples directory to see how these bindings are created automatically.

### Todos

[http://todos.derbyjs.com/derby](http://todos.derbyjs.com/derby)

The requisite MVC demo, but collaborative and realtime! Todo items are contenteditable fields with support for bold and italics.

### Sink

[http://sink.derbyjs.com/](http://sink.derbyjs.com/)

A kitchen-sink style example with random features. Largely used for testing.

## Disclaimer

Derby and Racer are alpha software. While Derby should work well enough for prototyping and weekend projects, it is still undergoing major development. APIs are subject to change.

If you have feedback, ideas, or suggestions, please email the [Google Group](http://groups.google.com/group/derbyjs). If you are interested in contributing, please reach out to [Brian](https://github.com/bnoguchi) and [Nate](https://github.com/nateps).

# Getting started

As with all Node.js modules, first install [Node](http://nodejs.org/#download). The Node installer will also install [npm](http://npmjs.org/).

Install Derby with:

    $ npm install -g derby

## Create an app

Derby includes a simple project generator:

    $ cd ~
    $ derby new first-project
    $ cd first-project

or, for [CoffeeScript](http://jashkenas.github.com/coffee-script/):

    $ cd ~
    $ derby new --coffee first-project
    $ cd first-project
    $ make

`make` will execute the coffee compiler with the watch option, so leave it running in a separate terminal.

Then, simply fire up Node:

    $ node server.js

## File structure

The default file structure is:

    /lib
      /app
        index.js
      /server
        index.js
    /public
      /img
      /gen
    /styles
      /app
        index.styl
      404.styl
      base.styl
      reset.styl
    /views
      /app
        index.html
      404.html
    .gitignore
    package.json
    README.md
    server.js

In [CoffeeScript](http://jashkenas.github.com/coffee-script/) projects, the `lib` directory is generated by the compiler, and script files should be edited in the `src` directory instead. The project generator will create a `Makefile` for compiling CoffeeScript projects.

Derby uses a filename based convention similar to Node.js modules. A file named `demo.js` and a directory `demo` containing a file `index.js` both define an app with the name "demo." The same applies for styles and views, which can either be `demo.styl` or `demo\index.styl` and `demo.html` or `demo\index.html`.

Apps are associated with their respective styles and views by filename only. Derby automatically includes them when rendering. Both support importing, so shared styles and templates may be defined in separate files.

Static files can be placed in the public folder. The default Express server created by the Derby project generator sets a cache time of one year for all static files. Therefore, new file versions must be given new filenames. Derby compiles scripts for the browser into the `public\gen` folder by default. Each script's filename is generated from a hash, so that it can be cached long term.

## Persistence

Derby's models are powered by [Racer](http://racerjs.com/). By default, Racer stores data in memory, so nothing will be persisted between server restarts. We are currently putting the final touches on the first database adapter, which will support MongoDB.

# Apps and static pages

Derby projects support one or more single-page apps as well as static pages. Apps have a full MVC structure, including a model provided by [Racer](http://racerjs.com/), a template and styles based view, and controller code with application logic and routes (which map URLs to actions). Static pages consist of only templates and styles.

On the server, apps provide a router middleware for Express. One or more app routers as well as server only routes can be included in the same Express server. 

Derby packages up all of an app's templates, routes, and application code when rendering. Regardless of which app URL the browser requests initially, the app is able to render any other state within the same application client-side. If the app cannot handle a URL, it will fall through and request from the server. Errors thrown during route handling also cause requests to fall through to the server.

Derby works great with only a single app, though developers may wish to create separate apps if only certain sets of pages are likely to be used together. For example, a project might have a separate desktop web app and mobile web app. Or a project might have an internal administration panel app and a public content app.

## Creating apps

Apps are created in the file that defines the app's controller code. They are then associated with a server by requiring the app within the server file.

> ### `app = `derby.createApp` ( module )`
> 
> **module:** Derby uses the module object to create an app. The app's name is taken from its filename, and Derby exports a number of methods on the app.
> 
> **app:** Returns an app object, which is equivalent to `module.exports`.

The app's filename is used to determine the name of the app. App names are used to automatically associate an app with template and styles files of the same name.

The app name is also used as the name of the global variable that the application exposes in the browser. Therefore, app names should be valid JavaScript variable names, starting with a letter and containing only alphanumeric characters and underscores.

The `createApp` method adds a number of methods to the app. On both the client and the server, these are `view`, `render`, `ready`, `get`, `post`, `put`, `del`, and `hook`. On the server only, Derby also adds `router`, `createStore`, and `session`.

## Connecting servers to apps

The Derby project generator outputs an Express server for a typical setup. Because Derby shares most code between server and client, Derby server files can be very minimal.

The server includes an app with a standard Node.js require statement. It can then use the `app.router()` method to create a router middleware for Express that handles all of the app's routes.

The server also needs to create a `store` object, which is what sets up Socket.IO, creates models, coordinates data syncing, and interfaces with databases. A store associated with one app can be created using that app's `app.createStore()` method. If a store is shared among multiple apps, it should be created using the `derby.createStore()` method, which is passed each of the apps as aruguments. See [Creating stores](#creating_stores).

## Static pages

Derby can also render static pages from templates and styles not associated with an app. This is useful for error pages and other pages that don't need dynamic content.

> ### `staticPages = `derby.createStatic` ( root )`
> 
> **root:** The root path that contains the "views" and "styles" directories.
> 
> **staticPages:** Returns a staticPages object, which has a render method. (While unused, static is a [reserved JavaScript keyword](https://developer.mozilla.org/en/JavaScript/Reference/Reserved_Words), and it cannot be a variable name.)

The staticPages object keeps a reference to the directory root and provides a `staticPages.render()` method. It is intended for use in server-only Express routes. See [Rendering](#rendering).

# Views

Typically, writing Derby apps begins with HTML templates. These templates define the rendered HTML as well as model-view bindings.

## Creating templates

Derby compiles a collection of HTML-based templates into a page based on a number of pre-defined names. Pages usually define at least a `Title` and `Body` template. Templates may be created programatically via the `view.make()` method:

{% highlight javascript %}
var view = require('derby').createApp(module).view

view.make('Body', '<h1>Howdy!</h1>')
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

By default, Derby includes templates with the names `Doctype`, `Root`, `Charset`, `Title`, `Head`, `Header`, `Body`, `Footer`, `Scripts`, and `Tail` when it renders a page on the server.

In the browser, only the `Root`, `Title`, `Header`, `Body`, and `Footer` templates are re-rendered. Thus, model-view bindings may only be defined within these templates.

Some of pre-defined templates have names that also are the names of HTML tags, but only `Title` wraps the template inside of a `<title>` tag. Derby does *not* include any non-required HTML elements, such as `<html>`, `<head>`, and `<body>` by default.

By convention, Pre-defined template names are capitalized to indicate that the page renderer will include them automatically. However, since HTML tags are case-insensitive, Derby template names are also case insensitive. Thus, `Body`, `BODY`, and `body` all represent the same template.

Note that template files don't contain boilerplate HTML, such as doctype definitions, stylesheets, and script includes. By default, Derby includes these items in an order optimized for fast load times. Also to optimize load time, it sends pages a number of chunks:

#### First chunk

1. **`Doctype:`** Standard HTML5 doctype---`<!DOCTYPE html>`---unless overridden 
2. **`Root:`** Optional location for an `<html>` element if desired. This template should not include any other elements
3. **`Charset:`** `<meta charset=utf-8>` unless overridden
4. **`Title:`** The text content of the page's `<title>` element
5. **`Head:`** Optional location for meta tags, scripts that must be placed in the HTML `<head>`, and manually included stylesheets
6. CSS is compiled and inserted after the Head template automatically
7. **`Header:`** Optional location for a page header that will be sent with the initial response chunk. Note that this is actually part of the HTML `<body>`, but it should render correctly by itself. It is separated out so that it can be displayed to the user before the rest of the page if the remainder of the page takes a while to download. Typically this includes fixed content, such as a logo and a top navigation bar

#### Second chunk

8. **`Body:`** The page's main content
9. **`Footer:`** Optional location for content to include after the body. Used for copyright notices, footer links, and other content repeated at the bottom of multiple pages

#### Third chunk

10. Inline scripts placed in a file named `inline.js` or added via the `view.inline()` method. Scripts are typically included this way if they are needed to properly render the page, such as resizing an element based on the window size
11. **`Scripts:`** Optional location for external scripts loaded before the client scripts. For example, this is where a script tag that includes jQuery would be placed. Note that this template is just a location within the page, and it is not wrapped in a script tag
12. Client scripts are automatically included via an asynchronously loaded external script. The name of the script is a hash of its content so that it can be cached by the browser long term

#### Fourth chunk

13. JSON bundle of the model data, event bindings, and other data resulting from rendering the page. This bundle initializes the application once the external client script loads
14. **`Tail:`** Optional location for additional scripts to be included at the very end of the page

<style>
ol{counter-reset: item}
ol>li{display: block}
ol>li:before{content: counter(item) ". "; counter-increment: item}
#second_chunk+ol{counter-reset: item 7}
#third_chunk+ol{counter-reset: item 9}
#fourth_chunk+ol{counter-reset: item 12}
</style>

### Importing templates

Templates can be imported from another file for making multiple page apps and sharing templates among multiple pages. File paths are expessed relatively, similar to how Node.js modules are loaded. Like in Node.js modules, either `pageName.html` or `pageName/index.html` can be imported as `pageName`.

{% highlight html %}
<!-- all templates from "./home.html" with the namespace "home" -->
<import: src="home">

<!-- all templates from "./home.html" into the current namespace -->
<import: src="home" ns="">

<!-- one or more specific templates with the namespace "home" -->
<import: src="home" template="message alert">

<!-- one template as a different name in the current namespace -->
<import: src="home" template="message" as="myMessage">
{% endhighlight %}

Templates defined in a parent namespace are inherited unless they are overridden by a template with the same name in the child namespace. Thus, it often makes sense to place common page elements in a main file that imports a number of other files and override the part of the page that is different.

Template partials are referenced relative to their current namespace. Namespaces are separated by colons, and a namespace can be passed to the `page.render()` method to render a specific page or application state.

#### shared.html
{% highlight html %}
<profile:>
  <div class="profile">
    ...
  </div>
{% endhighlight %}

#### home.html
{% highlight html %}
<import: src="shared">

<Body:>
  Welcome to the home page
  <!-- include template partial from an imported namespace -->
  {{"{{"}}> shared:profile}}
{% endhighlight %}

#### index.html
{% highlight html %}
<import: src="home">
<import: src="contact">
<import: src="about">

<Body:>
  Default page content

<Footer:>
  <p><small>&copy; {{"{{"}}year}}</small></p>
{% endhighlight %}

#### Context
{% highlight javascript %}
page.render('home', {
  year: 2012
})
{% endhighlight %}
{% highlight coffeescript %}
page.render 'home',
  year: 2012
{% endhighlight %}


## Template syntax

Derby's template syntax is largely based on [Handlebars](http://handlebarsjs.com/), a popular logic-less templating language similar to [Mustache](http://mustache.github.com/mustache.5.html).

A simple Handlebars template:

    Hello {{"{{"}}name}}
    You have just won ${{"{{"}}value}}!
    {{"{{"}}#if inCalifornia}}
    Well, ${{"{{"}}taxedValue}}, after taxes.
    {{"{{"}}/if}}

Given the following data context:

    {
      name: "Chris",
      value: 10000,
      taxedValue: 10000 - (10000 * 0.4),
      inCalifornia: true
    }

Will produce the following:

    Hello Chris
    You have just won $10000!
    Well, $6000.0, after taxes.

Logic-less templates better enforce separation of logic from presentation by making it impossible to embed logic within views. Instead of conditional statements and loops, logic-less templates use a restricted set of template tags. These tags are replaced with data passed in when the template is rendered. This data is often referred to as the "context."

With Handlebars, application code generates a context object before rendering the view. It then passes that object along with the template at render time. Derby templates can be used this way as well. However, in addition to looking for objects in a context object, Derby assumes that the model is part of the context. Even better, Derby is able to automatically establish live bindings between the view and objects in the model. Derby slightly extends the Handlebars syntax in order to support these featueres.

The other major difference between Handlebars and Derby templates is that Derby templates must be valid HTML first. Handlebars is language agnostic---it can be used to compile anything from HTML to source code to a document. However, Derby templates are first parsed as HTML so that the parser can understand how to bind data to the surrounding DOM objects. Template tags are only allowed within elements or text, within attribute values, and surrounding elements.

#### Invalid template tag placements
{% highlight html %}
<!-- INVALID: Within element names -->
<{{"{{"}}tagName}}>Bad boy!</{{"{{"}}tagName}}>

<!-- INVALID: Within attribute names -->
<b {{"{{"}}attrName}}="confused" {{"{{"}}booleanAttr}}>Bad boy!</b>

<!-- INVALID: Splitting an html tag -->
<b{{"{{"}}#if maybe}}>Bad boy!</b{{"{{"}}/}}>

<!-- INVALID: Splitting an element -->
{{"{{"}}#if maybe}}<b>{{"{{"}}/}}Bad boy!</b>
{% endhighlight %}

#### Valid placements
{% highlight html %}
<!-- Within an element -->
Let's go <b>{{"{{"}}activity}}</b>!

<!-- Within text -->
<b>Let's go {{"{{"}}activity}}!</b>

<!-- Within attribute values -->
<b style="color:{{"{{"}}displayColor}}">Let's go running!</b>

<!-- Surrounding one or more elements and text -->
{{"{{"}}#if maybe}}<b>Let's go dancing!</b>{{"{{"}}/}}
{% endhighlight %}

### Whitespace and HTML conformance

Before parsing, all HTML comments, leading whitespace, and new lines are removed from templates. Whitespace at the end of lines is maintained, in case a space is desired in the HTML output. The contents of `<script>` and `<style>` tags are passed through literally.

Derby's HTML parser should be able to parse any valid HTML, including elements that don't require closing tags and unquoted attributes. However, it is recommended that you always include closing tags for elements like `<p>` and `<li>` that might not require a closing tag. The rules around how tags are automatically closed are complex, and there are certain cases where template sections may be included within an unexpected element. 

HTML attribute values only need to be quoted if they are the empty string or if they contain a space, equals sign, or greater than sign. Since Derby templates are parsed as HTML first, any of these characters within a template tag require an attribute to be escaped. Using quotes around all attribute values is recommended.

Because it understands the HTML context, Derby's HTML escaping is much more minimal than that of most templating libraries. You may be surprised to see unescaped `>` and `&` characters. These only need to be escaped in certain contexts, and Derby only escapes them when needed. If you are skeptical, an [HTML5 validator](http://html5.validator.nu/) will detect most escaping bugs.

Throughout these docs, the output of templates is shown indented and on multiple lines for the sake of readability. However, Derby's renderer would not output any indentation or line breaks. In addition, output attribute values are quoted, but Derby only includes quotes around attribute values if they are needed.

### Variables

Variables insert a value from the context or model with a given name. If the name isn't found, nothing will be inserted. Values are HTML escaped by default. Triple braces may be used to insert a value without escaping.

#### Template

{% highlight html %}
<Body:>
  <p>{{"{{"}}name}}
  <p>{{"{{"}}age}}
  <p>{{"{{"}}location}}
  <p>{{"{{"}}{location}}}
{% endhighlight %}

#### Context

{% highlight javascript %}
page.render({ name: 'Parker', location: '<b>500 ft</b> away' })
{% endhighlight %}
{% highlight coffeescript %}
page.render name: 'Parker', location: '<b>500 ft</b> away'
{% endhighlight %}

#### Output

{% highlight html %}
<p>Parker
<p>
<p>&lt;b>500 ft&lt;/b> away
<p><b>500 ft</b> away
{% endhighlight %}

### Sections

Sections set the scope of the context for their contents. In the case of `if`, `unless`, and `each`, they also  cause their contents to be conditionally rendered. `with` is used to only set the scope and always render. In Handlebars, sections begin and end with the same block type, but Derby requires only an ending slash.

In Handlebars, falsey values include all falsey JavaScript values (`false`, `null`, `undefined`, `0`, `''`, and `NaN`) as well as empty arrays (`[]`). All other values are truthy.

#### Template

{% highlight html %}
<Body:>
  <h1>
    {{"{{"}}#if visited}}
      Welcome back!
    {{"{{"}}else}}
      Welcome to the party!
    {{"{{"}}/}}
  </h1>
  <ul>
    {{"{{"}}#each users}}
      <li>{{"{{"}}name}}: {{"{{"}}motto}}
    {{"{{"}}/}}
  </ul>
  {{"{{"}}#unless hideFooter}}
    {{"{{"}}#with meta}}
      <small>Copyright &copy; {{"{{"}}year}} Party Like It's.</small>
    {{"{{"}}/}}
  {{"{{"}}/}}
{% endhighlight %}

#### Context

{% highlight javascript %}
page.render({
  visited: true
, users: [
    { name: 'Billy', motto: "Shufflin', shufflin'" }
  , { name: 'Ringo', motto: "Make haste slowly." }
  ]
, meta: {
    year: 1999
  }
})
{% endhighlight %}
{% highlight coffeescript %}
page.render
  visited: true
  users: [
    { name: 'Billy', motto: "Shufflin', shufflin'" }
    { name: 'Ringo', motto: "Make haste slowly." }
  ]
  meta:
    year: 1999
{% endhighlight %}

#### Output

{% highlight html %}
<h1>Welcome back!</h1>
<ul>
  <li>Billy: Shufflin', shufflin'
  <li>Ringo: Make haste slowly
</ul>
<small>Copyright &copy; 1999 Party Like It's.</small>
{% endhighlight %}

Note how in the above example, the context becomes each array item inside of the `#each users` section. Similarly, sections set scope when reffering to the name of an object. In addition to the local scope, template tags may refer to anything in the parent scope.

#### Template

{% highlight html %}
<Body:>
  {{"{{"}}#with users.jill}}
    I like <a href="{{"{{"}}link}}">{{"{{"}}favorite}}</a>.
  {{"{{"}}/}}
{% endhighlight %}

#### Context

{% highlight javascript %}
page.render({
  users: {
    jill: {
      favorite: 'turtles'
    }
  }
, link: 'http://derbyjs.com/'
});
{% endhighlight %}
{% highlight coffeescript %}
page.render
  users:
    jill:
      favorite: 'turtles'
  link: 'http://derbyjs.com/'
{% endhighlight %}

#### Output

{% highlight html %}
I like <a href="http://derbyjs.com/">turtles</a>.
{% endhighlight %}

### Partials

Partials are used to include one template inside of another. The scope of the parent context is inherited inside of the partial. Both for code readability and for more efficient template compilation, it is best to keep individual templates relatively simple and use partials for each significant unit.

As in Handlebars, partials are included by name with the syntax `{{"{{"}}> profile}}`. Because it is common to use a partial to render each item in a list or otherwise use a section to set the context for a partial, Derby supports the additional `{{"{{"}}each users > profile}}` syntax. This is equivalent to `{{"{{"}}#each}}{{"{{"}}> profile}}{{"{{"}}/}}`. `if`, `unless`, and `with` are valid as well as `each`.

#### Template

{% highlight html %}
<Body:>
  {{"{{"}}> nav}}

<nav:>
  <ul>{{"{{"}}each navItems > navItem}}</ul>

<navItem:>
  <li><a href="{{"{{"}}link}}">{{"{{"}}title}}</a></li>
{% endhighlight %}

#### Context

{% highlight javascript %}
page.render({
  navItems: [
    { title: 'Home', link '/' }
  , { title: 'About', link '/about' }
  , { title: 'Contact us', link '/contact' }
  ]
});
{% endhighlight %}
{% highlight coffeescript %}
page.render
  navItems: [
    { title: 'Home', link '/' }
    { title: 'About', link '/about' }
    { title: 'Contact us', link '/contact' }
  ]
{% endhighlight %}

#### Output

{% highlight html %}
<ul>
  <li><a href="/">Home</a></li>
  <li><a href="/about">About</a></li>
  <li><a href="/contact">Contact us</a></li>
</ul>
{% endhighlight %}

### Bindings

Model-view binding is a relatively recent approach to adding dyanmic interaction to a page. Its use of declarative syntax dramatically lowers the amount of repetative, error-prone DOM manipulation code in an application. With Derby's bindings system, it should rarely be neccessary to write any DOM code at all.

Derby templates declare bindings by using double or triple parentheses instead of curly braces. Bound template tags output their values in the initally rendered HTML just like unbound tags. In addition, they create bindings that update the view immediately whenever the model changes. If bindings are used for elements that change upon user interaction---such as form inputs---Derby will update the model automatically as their values change.

Any template tag may be live bound, except for within an `id` attribute. The id must be set at render time and not change until the element is re-rendered, since it is used to figure out which element to update.

Bindings only work for data in the model. Context data is passed in at render time, and it doesn't change dynamically. If a binding tag uses a name not in the context object or the model at render time, it is still bound to the model, since the path may be defined later.

#### Template

{% highlight html %}
<Body:>
  Holler: <input value="((message))"><h1>((message))</h1>
{% endhighlight %}

#### Context
  
{% highlight javascript %}
model.set('message', 'Yo, dude.')
page.render()
{% endhighlight %}
{% highlight coffeescript %}
model.set 'message', 'Yo, dude.'
page.render()
{% endhighlight %}

#### Output

{% highlight html %}
Holler: <input value="Yo, dude." id="$0"><h1 id="$1">Yo, dude.</h1>
{% endhighlight %}

Note that the value in the model at render time is inserted into the HTML, as with a non-bound template tag. In addition, Derby establishes an event listener for the input element that sets the value of `message` whenever the user modifies the text of the input element. It also sets up a listeners for both the input and the h1 element to update their displayed values whenever `message` changes.

Rather than re-rendering the entire template when a value changes, only the individual elements are updated. In the case of the input, its `value` property is set; in the case of the h1, its `innerHTML` is set. Since neither of these elements have an `id` attribute specified in the template, Derby automatically creates ids for them. All DOM ids created by Derby begin with a dollar sign ($). If an element already has an id, Derby will use that instead.

Derby associates all DOM event listeners with an `id`, because getting objects by id is a fast DOM operation, it makes dealing with DOM events more efficient, and event listeners continue working even if other scripts modify the DOM unexpectedly. Derby internally tracks events via ids, allowing it to render pages on the server and then re-establish the same event listeners on the client efficiently.

If a bound template tag or section is not fully contained by an HTML element, Derby will wrap the template by placing comment markers before and after the location of the template. Comments are used, because they are valid in any location. A number of HTML elements have restrictions that make it impossible to wrap a template in an additional element. For example, `<tr>` elements may only contain `<td>` and `<th>` elements.

#### Template

{% highlight html %}
<Body:>
  Welcome to our ((adjective)) city!
{% endhighlight %}

#### Context
  
{% highlight javascript %}
model.set('adjective', 'funny')
page.render()
{% endhighlight %}
{% highlight coffeescript %}
model.set 'adjective', 'funny'
page.render()
{% endhighlight %}

#### Output

{% highlight html %}
Welcome to our <!--$0-->funny<!--$$0--> city!
{% endhighlight %}

### Relative model paths and aliases

For items in the context object, objects from the parent scope can still be referred to directly from within sections. However, bindings are set up when templates are initially compiled, and objects defined in the model may change. Thus, model paths must refer to the full path regardless of location within the template.

Yet, a template might need to define how each item in an array should be rendered as well as bind to those items. In this case, relative model paths may be used. Paths relative to the current scope begin with a dot (`.`).

#### Template

{% highlight html %}
<Body:>
  <ul>((each items > item))</ul>

<item:>
  <li><a href="{{"{{"}}url}}">((.name))</a>: $((.price))
{% endhighlight %}

#### Context

{% highlight javascript %}
model.set('items', [
  { name: 'Cool can', price: 5.99, url: '/p/0' }
, { name: 'Fun fin', price: 10.99, url: '/p/1' }
, { name: 'Bam bot', price: 24.95, url: '/p/2' }
])
page.render()
{% endhighlight %}
{% highlight coffeescript %}
model.set 'items', [
  { name: 'Cool can', price: 5.99, url: '/p/0' }
  { name: 'Fun fin', price: 10.99, url: '/p/1' }
  { name: 'Bam bot', price: 24.95, url: '/p/2' }
]
page.render()
{% endhighlight %}

#### Output

{% highlight html %}
<ul id="$0">
  <li><a href="/p/0" id="$1">Cool can</a>: $<!--$2-->5.99<!--$$2-->
  <li><a href="/p/1" id="$3">Fun fin</a>: $<!--$4-->10.99<!--$$4-->
  <li><a href="/p/2" id="$5">Bam bot</a>: $<!--$6-->24.95<!--$$6-->
</ul>
{% endhighlight %}

In the above example, note that the `url` is not bound, and it does not start with a dot. Since the context of the partial will be set to the array item at render time, this will render the value correctly, but it will not update if the value changes. `.name` and `.price` start with a dot, because they are bound to paths in the model relative to the item being rendered. Whenever the name or the price of an item changes, the appropriate fields will be updated in realtime. In addition, the entire list is bound. If a new item is added, an item is removed, or the items are reordered, the list will be updated in realtime.

Aliases to a specific scope may be defined, enabling relative model path references within nested sections. Aliases begin with a colon (`:`), and can be defined within a section tag or a partial tag that sets the scope.

#### Template

{% highlight html %}
<Body:>
  <h2>Toys in use:</h2>
  ((#each toys :toy))
    ((#if :toy.inUse))
      {{"{{"}}> toyStatus}}
    ((/))
  ((/))
  <h2>All toys:</h2>
  ((each toys :toy > toyStatus))

<toyStatus:>
  <p>{{"{{"}}name}} on the ((:toy.location))</p>
{% endhighlight %}

#### Context

{% highlight javascript %}
model.set('toys', [
  { name: 'Ball', location: 'floor', inUse: true }
, { name: 'Blocks', location: 'shelf' }
, { name: 'Truck', location: 'shelf' }
])
page.render();
{% endhighlight %}
{% highlight coffeescript %}
model.set 'toys', [
  { name: 'Ball', location: 'floor', inUse: true }
  { name: 'Blocks', location: 'shelf' }
  { name: 'Truck', location: 'shelf' }
]
page.render()
{% endhighlight %}

#### Output

{% highlight html %}
<h2>Toys in use:</h2>
<!--$0-->
  <!--$1--><p>Ball on the <!--$2-->floor<!--$$2--></p><!--$$1-->
  <!--$3--><!--$$3-->
  <!--$4--><!--$$4-->
<!--$$0-->
<h2>All toys:</h2>
<!--$5-->
  <p>Ball on the <!--$6-->floor<!--$$6--></p>
  <p>Blocks on the <!--$7-->shelf<!--$$7--></p>
  <p>Truck on the <!--$8-->shelf<!--$$8--></p>
<!--$$5-->
{% endhighlight %}

## HTML extensions

Derby provides a few extensions to HTML that make it easier to bind models and views.

Custom attributes used during template parsing start with the prefix `x-` to avoid conflicts with future extensions to HTML. Note that Derby uses this prefix instead of `data-`, since that prefix is intended for custom data attributes that are included in the DOM. Derby removes `x-` attributes as it parses, and the output HTML does not include these non-standard attributes.

### DOM event binding

The `x-bind` attribute may be added to any HTML element to bind one or more DOM events to a controller function by name. The bound function must be exported on the app. Bound functions are passed the original event object, the element on which the `x-bind` attribute was placed, and a `next()` function that can be called to continue event bubbling.

Browsers emit DOM events on the target and then each of its parent nodes all the way up to the document's root element, unless a handler calls `e.stopPropogation()`. Derby performs event bubbling more like routes---the handler function for the target element or the first bound parent element is called and then event bubbling stops. The handler can call the `next()` function to continue bubbling the event up.

The `x-capture` attribute may be used if the handler should *always* be called whenever a child element emits a given event. This may be especially useful on the root `<html>` element for handling events like `mousemove`.

If the click event is bound on an `<a>` tag without an `href` attribute, Derby will add the attributes `href="#"` and `onclick="return false"` automatically. If the submit event is bound on a `<form>` tag, `onsubmit="return false"` will be added to prevent a default redirect action.

Event bindings can also delay the callback's execution after a timeout. This can be useful when handling events like paste, which is fired before new content is inserted. The value of the delay in milliseconds is included after the name of the event, such as `x-bind="paste/0: afterPaste"`.

Internally, Derby only binds each type of event once to the `document` and performs event delegation. It uses element ids to keep track of which elements should be bound to which events. Thus, much like with model-view bindings, Derby will add an automatically generated `id` attribute to an element that uses `x-bind` if it does not already have an id.

#### Template

{% highlight html %}
<Root:>
  <!-- always called regardless of event bubbling -->
  <html x-capture="mousemove: move">

<Body:>
  <button x-bind="click: start">Start</button>

  <!-- href="#" and onclick="return false" will be added -->
  <a x-bind="click: cancel">Cancel</a>

  <!-- onsubmit="return false" will be added -->
  <form x-bind="submit: search"> </form>

  <!-- Multiple events on one element -->
  <img src="example.png" x-bind="mousedown: down, mouseup: up">

  <!-- Wait for timeout of 50ms before calling back -->
  <input x-bind="paste/50: afterPaste">
{% endhighlight %}

It is often useful to relate back a DOM element to the model path that was used to render the item. For example, one might want to remove an item from a list when a button is clicked. Derby extends the `model.at()` method to accept a DOM node or jQuery object. When passed one of these, the method will return a [scoped model](#scoped_models) that is scoped to the context of the closest bound path in the template.

#### Template

{% highlight html %}
<Body:>
  <ul>
    ((#each _users))
      <li x-bind="click: upcase">((.name))</li>
    ((/))
  </ul>
{% endhighlight %}

#### App

{% highlight javascript %}
exports.upcase = function(e, el, next) {
  user = model.at(el)

  // Logs something like "_users.3"
  console.log(user.path())

  user.set('name', user.get('name').toUpperCase())
}
{% endhighlight %}
{% highlight coffeescript %}
exports.upcase = (e, el, next) ->
  user = model.at el

  # Logs something like "_users.3"
  console.log user.path()

  user.set 'name', user.get('name').toUpperCase()
{% endhighlight %}

### Boolean attributes

In HTML, boolean attributes are true when they are included and false when they are excluded. Since Derby only allows template tags inside attribute values, this makes it difficult to bind such attributes to model objects. Therefore, Derby uses a slightly modified syntax that works more naturally with the templating syntax for the attributes `checked`, `selected`, and `disabled`, which are likely to be bound to data.

There is also a special syntax for boolean attributes only where a data value can be inverted by putting a `!` before the template tag. This is especially useful with the disabled attribute.

{% highlight html %}
<Body:>
  <!-- Outputs:
    <input type="checkbox" checked>
    - or -
    <input type="checkbox">
  -->
  <input type="checkbox" checked="{{active}}">

  <!-- Bound to model -->
  <input type="checkbox" checked="((active))">

  <!-- Inverted value -->
  <input type="checkbox" disabled="!((active))">
{% endhighlight %}

### Form elements

Binding the selected attribute of `<option>` elements in a `<select>` is difficult, because the `change` event is only fired on the `<select>` element, and the `selected` attribute must be place on the options. Therefore, Derby distributes the change event to each of the children of a select element, raising the event on each of the options as well. This makes it possible to bind the selected state on each of the options.

For radio buttons, change events are only fired on the element that is clicked. However, clicking a radio button unchecks the value of all other radio buttons with the same name. Thus, Derby also emits the change event on other elements with the same name so that each radio button's checked attribute may be bound.

## Performance

While Derby's rendering performance has yet to be benchmarked and optimized, its architecture will ultimately enable it to outperform most current web application rendering approaches in real usage.

When large chunks of a page require updating, rendering HTML and then updating the innerHTML of an element is the fastest approach. However, when small changes to one item in a template occur, rerendering the entire template and replacing an entire section of the DOM is much slower than simply updating a single property or single element's innerHTML.

In addition, only rendering certain sections or an entire page client-side dramatically slows page loads. Even an extremely fast client-only renderer causes the browser to wait for the page to load a script (most likely via an additional request), interpret the script, render the template, and update the DOM before it has a chance to start performing layout of the HTML content.

Derby's architecture optimizes time to load the page initially, to re-render sections or the entire page client-side, and to update individual elements in realtime. It makes it easy for designers and developers to create application views with HTML-based templates, and it provides instant responsiveness with model-view bindings.

## Stylesheets

Derby uses **[Stylus](http://learnboost.github.com/stylus/)** to automatically compile and includes styles for each page. Stylus extends CSS with variables, mixins, functions, and other awesome features. It supports CSS style syntax interchangeably with a minimal whitespace based syntax. 

Derby also includes **[Nib](http://visionmedia.github.com/nib/)**, which adds a number of convenient CSS3 mixins to Stylus. Nib takes care of adding vendor prefixes, makes CSS gradients *much* easier, and has bunch of other useful features.

Stylus requires that files end in a `.styl` extension. It supports [importing other files](http://learnboost.github.com/stylus/docs/import.html), including support for `index.styl` files. Since Node.js, Derby templates, and Stylus all support similar file importing conventions, it is easy to use the same directory structure for analogous files in the `lib`/`src`, `views`, and `styles` directories.

Derby includes compiled CSS at the top of each page. Inlining CSS almost always decreases load time, and Stylus importing makes it easy to break up shared styles into files included in the appropriate pages. Note, however, that it is not optimial to include a very large amount of CSS, such as large data URI encoded images, at the top of the page. Large images are best loaded as separate files or inline at the bottom of the page, so that the rest of the page may be displayed first.

## Rendering

Views are rendered in response to [routes](#routes). Most routes should be defined inside of an app so that they can be handled both on the client and the server. Views can also be rendered in response to server only routes.

In each render method, `model`, `context`, and `status` arguments may be in any order or omitted.

> ### page.render` ( [context], [status] )`
> 
> **context:** *(optional)* Object specifying additional context objects to use in rendering templates.
> 
> **status:** *(optional)* Number specifying the HTTP status code. 200 by default. Has no effect when rendering on the client.

App routes supply a page object, which provides a consistent interface for rendering an entire page on both server and client. On the server, the page is rendered by calling Node.js response object methods like `res.write`. On the client, Derby renders the page locally. It then replaces the `document.title` and `document.body.innerHTML`, and updates the URL with `history.pushState`.

The page's render function implicitly renders in the context of the app's model. An additional context object may be supplied for items that are only needed at render time.

> ### app.render` ( res, model, [context], [status] )`
> 
> **res:** Response object passed to the Express routing callback
> 
> **model:** A Derby model object used for rendering. The contents of the model will be serialized and initialized into the same state in the browser once the page loads.
> 
> **context:** *(optional)* Additional context objects to use in rendering templates.
> 
> **status:** *(optional)* Number specifying the HTTP status code. 200 by default.

Apps may also be rendered within server only Express routes. In this case, it is neccessary to provide the renderer with a response object and model. On the server, Models are created with the `store.createModel()` method. If the Derby session middleware is used, it will create models automatically and set a reference to them on `req.model`.

> ### staticPages.render` ( name, res, [model], [context], [status] )`
> 
> **name:** Name of the view and style files to render
> 
> **res:** Response object passed to the Express routing callback
> 
> **model:** *(optional)* A Derby model object. A model object may be used for rendering, but it will not be serialized and included with a static page. Static pages don't have an associated app, and they don't include scripts by default.
> 
> **context:** *(optional)* Additional context objects to use in rendering templates.
> 
> **status:** *(optional)* Number specifying the HTTP status code. 200 by default.

For creating error pages and other static pages, Derby provides a `staticPages` object that renders a template and script file specified by name. Typically, this is used without a model object, but it is possible to supply a model object that is used for rendering only. See [Static pages](#static_pages).

## app.view

Derby adds an `app.view` object for creating and rendering views.

> ### view.make` ( name, template )`
> 
> **name:** Name of the template
> 
> **template:** A string containing the Derby template. Note that this should be only the content of the template, and it should not have a template name element, such as `<Body:>` at the start.

Apps should typically place all templates in a template file in the `views` folder instead of calling `view.make()` directly. However, templates may be added to an app this way as well.

Note that calling `view.make()` only renders the template; it does not include the template in the external script file separately. Thus, it must be called again on the client when the app loads.

> ### view.inline` ( fn )`
> 
> **fn:** Function to be inlined in the page and called immediately when the page loads.

This method is intended solely for server use and has no effect when called in the browser.

Scripts should be included inline in the page if needed to properly render the page. For example, a script might adjust the layout based on the window size, or it might autofocus a sign in box in browsers that don't support the HTML5 autofocus attribute.

Usually, it is preferable to place such scripts in a separate file called `inline.js` in the same directory as the app. This file will be automatically inlined when the app is created. Calling `view.inline()` directly does the same thing, but it is redundant to send the script inline and also include it in the app's external script file.

# Controllers

Derby controllers are defined in the script file that invokes `derby.createApp()`. Typically, controllers are located at `lib\app_name\index.js` or `src\app_name\index.coffee`. See [Creating apps](#creating_apps).

Controllers include routes, user event handlers, and application logic. Because Derby provides model-view bindings and syncs models automatically, directly manipulating the DOM and manually sending messages to the server should rarely be neccessary.

## Routes

Routes map URL patterns to actions. Derby routes are powered by [Express](http://expressjs.com/), which is similar to [Sinatra](http://www.sinatrarb.com/). Within apps, routes are defined via the `get`, `post`, `put`, and `del` methods of the app created by `derby.createApp()`.

> ### app.get` ( pattern, callback(page, model, params, next) )`
> ### app.post` ( pattern, callback(page, model, params, next) )`
> ### app.put` ( pattern, callback(page, model, params, next) )`
> ### app.del` ( pattern, callback(page, model, params, next) )`
>
> **pattern:** A string containing a literal URL, an Express route pattern, or a regular expression. See [Express's routing documentation](http://expressjs.com/guide.html#routing) for more info.
>
> **callback:** Function invoked when a request for a URL matching the appropriate HTTP method and pattern is received. Note that this function is called both on the server and the client.
>
> **page:** Object with the methods [`page.render()`](#pagerender)  and `page.redirect()`. All app routes should call one of these two methods or pass control by calling `next()`.
>
> **model:** Derby model object
>
> **params:** An object containing the matching URL parameters. The `url`, `query`, and `body` properties typically available on `req` are also added to this object.
>
> **next:** A function that can be called to pass control to the next matching route. If this is called on the client, control will be passed to the next route defined in the app. If no other routes in the same app match, it will fall through to a server request.

> ### page.redirect` ( url, [status] )`
>
> **url:** Destination of redirect. [Like Express][expressRedirect], may also be the string 'home' (which redirects to '/') or 'back' (which goes back to the previous URL).
>
> **status:** *(optional)* Number specifying HTTP status code. Defaults to 302 on the server. Has no effect on the client.

[expressRedirect]: http://expressjs.com/guide.html#res.redirect()

Unlike Express, which provides direct access to the `req` and `res` objects created by Node HTTP servers, Derby returns `page`, `model`, and `params` objects. These provide the same interface on the client and the server, so that route handlers may be executed in both environments. 

Express is used directly on the server. On the client, Derby inclues Express's route matching module. When a link is clicked or a form is submitted, Derby first tries to render the new URL on the client.

Derby can also capture form submissions client-side. It provides support for `post`, `put`, and `del` HTTP methods using the same hidden form field [override approach](http://expressjs.com/guide.html#http-methods) as Express.

### History

For the most part, updating the URL client-side should be done with normal HTML links. The default action of requesting a new page from the server is canceled automatically if the app has a route that matches the new URL.

To update the URL after an action other than clicking a link, scripts can call methods on `view.history`. For example, an app might update the URL as the user scrolls and the page loads more content from a paginated list.

> ### view.history.push` ( url, [render], [state], [e] )`
> ### view.history.replace` ( url, [render], [state], [e] )`
>
> **url:** New URL to set for the current window
>
> **render:** *(optional)* Re-render the page after updating the URL if true. Defaults to true
>
> **state:** *(optional)* A state object to pass to the `window.history.pushState` or `window.history.replaceState` method. `$render` and `$method` properties are added to this object for internal use when handling `popstate` events
>
> **e:** *(optional)* An event object whose `stopPropogation` method will be called if the URL can be rendered client-side

Derby's `history.push` and `history.replace` methods will update the URL via `window.history.pushState` or `window.history.replaceState`, respectively. They will fall back to setting `window.location` and server-rendering the new URL if a browser does not support these methods. The `push` method is used to update the URL and create a new entry in the browser's back/forward history. The `replace` method is used to only update the URL without creating an entry in the back/forward history.

> ### view.history.refresh` ( )`
>
> Re-render the current URL client-side

For convenience, the navigational methods of [`window.history`](https://developer.mozilla.org/en/DOM/window.history) can also be called on `view.history`.

> ### view.history.back` ( )`
>
> Call `window.history.back()`, which is equivalent to clicking the browser's back button

> ### view.history.forward` ( )`
>
> Call `window.history.forward()`, which is equivalent to clicking the browser's forward button

> ### view.history.go` ( i )`
>
> Call `window.history.go()`
>
> **i:** An integer specifying the number of times to go back or forward. Navigates back if negative or forward if positive

## User events

Derby automates a great deal of user event handling via [model-view binding](#bindings). This should be used for any data that is tied directly to an element's attribute or HTML content. For example, as users interact with an `<input>`, value and checked properties will be updated. In addition, the `selected` attribute of `<option>` elements and edits to the innerHTML of `contenteditable` elements will update bound model objects.

For other types of user events, such as `click` or `dragover`, Derby's [`x-bind`](#dom_event_binding) attribute can be used to tie DOM events on a specific element to a callback function in the controller. Such functions must be exported on the app module.

Even if controller code is responding to a DOM event, it should typically only update the view indirectly by manipulating data in the model. Since views are bound to model data, the view will update automatically when the correct data is set. While this way of writing client code may take some getting used to, it is ultimately much simpler and less error-prone.

## Model events

[Model events](#model_events) are emitted in response to changes in the model. These may be used directly to update other model items and the resulting views, such as updating a count of the items in a list every time it is modified.

## Application logic

Application logic executes in response to routes, user events, and model events. Code that responds to user events and model events should be placed within the `app.ready()` callback. This provides the model object for the client and makes sure that the code is only executed on the client.

> ### app.ready` ( callback(model) )`
>
> **callback:** Function called as soon as the Derby app is loaded on the client. Note that any code within this callback is only executed on the client and not on the server.
>
> **model:** The Derby model object for the given client

Application logic should be written to share as much code between servers and clients as possible. For security reasons or for direct access to backend services, it may be neccessary to only perform certain functions on servers. However, placing as much code as possible in a shared location allows Derby apps to be extremely responsive and work offline by default.

# Models

Derby models are powered by [Racer](http://racerjs.com/), a realtime model synchronization engine. Racer enables mutliple users to interact with the same data objects via sophisticated conflict detection and resolution algorithms. At the same time, it provides a simple object accessor and event interface for writing application logic.

## Introduction to Racer

On the server, Racer creates a `store`, which manages data updates. It is possible to directly manipulate data via asynchronous methods on a store, similar to interacting with a database. Stores also create `model` objects, which provide a synchronous interface more like interacting directly with objects.

Models maintain their own copy of a subset of the global state. This subset is defined via [subscriptions](#subscription) to certain paths. Models perform operations independently, and they automatically synchronize their state with the associated store over [Socket.IO](http://socket.io/).

When models are modified, they will immediately reflect the changes. In the background, Racer turns operations into transactions that are sent to the server and applied or rejected. If the transactions are accepted, they are sent to all other clients subscribed to the same data. This optimistic approach provides immediate interaction for the user, makes writing application logic easier, and enables Racer to work offline.

Model [mutator methods](#mutators) provide callbacks invoked after success or failure of a transaction. These callbacks can be used to provide application-specific conflict resolution UIs. Models also emit events when their contents are updated, which Derby uses to update the view in realtime.

### Conflict resolution

Currently, Racer defaults to applying all transactions in the order received, i.e. last-writer-wins. For realtime-connected clients, this will typically result in expected behavior. However, offline users interacting with the same data are likely to produce conflicting updates that could lead to unexpected behavior.

Therefore, Racer suppots conflict resolution via a combination of [Software Transactional Memory (STM)](http://en.wikipedia.org/wiki/Software_transactional_memory), [Operational Transformation (OT)](http://en.wikipedia.org/wiki/Operational_transformation), and [Diff-match-patch](http://en.wikipedia.org/wiki/Diff) techniques.

These features are not fully implemented yet, but the [Racer demos](https://github.com/codeparty/racer#readme) show preliminary examples of STM and OT. Letters uses STM mode to automatically detect conflicts when different users move the same letters at the same time. Pad uses OT for a minimal collaborative text editor.

To perform these algorithms, Racer stores a journal of all transactions. When new transactions arrive, their paths and versions are compared to the transactions already commited to the journal. STM accepts a transaction if it is not in conflict with any other operations on the same path. STM works well when changes need to be either fully accepted or rejected, such as updating a username. In contrast, OT is designed for situations like collaborative text editing, where changes should be merged together. In OT, transactions are modified to work together in any order instead of being rejected.

## Creating stores

The default server produced by the Derby project generator will create a store asoociated with an app. Derby will then use that store to create models when invoking app routes.

> ### `store = `app.createStore` ( options )`
> ### `store = `derby.createStore` ( apps..., options )`
>
> **options:** An object that configures the store
>
> **store:** Returns a Racer store object
>
> **apps:** The `derby.createStore()` method accepts one or more Derby applications as arguments. Each of these apps is associated with the created store.

Typically, a project will have only one store, even if it has multiple apps. It is possible to have multiple stores, though an app can only be associated with one store.

### Configuration options

Typically a `listen` option is specified, which is used to setup Socket.IO. This option may be an Express server or a port number. In addition to listen, a `namespace` argument may be provided to setup Socket.IO under a namespace. See "Restricting yourself to a namespace" in the [Socket.IO guide](http://socket.io/#how-to-use).

Alternatively, options may specify `sockets` and `socketUri` if the Socket.IO sockets object is already created. The `sockets` option should be the object returned from Socket.IO's `io.listen().sockets` or `io.listen().of()`.

More information about configuring Racer to run with various PubSub, database, and journal adapters is coming soon.

## Creating models

Derby provides a model when calling application routes. On the server, it creates an empty model from the `store` associated with an app. When the server renders the page, the model is serialized. It is then reinitialized into the same state on the client. This model object is passed to the `app.ready()` callback and app routes rendered on the client.

If a model is assigned to `req.model`, Derby uses that instead of creating a new model. This can be used to pass data from server middleware to an application route. The Racer session middleware uses this to create a model with a `_session` object for a given cookie.

> ### `model = `store.createModel` ( )`
>
> **model:** A Racer model object associated with the given store

If using the the Racer session middleware, server-side routes can use the model supplied on `req.model`. Otherwise, they can manually create a model via `store.createModel()`.

## Model features

### Paths

All model operations happen on paths which represent literal nested objects. These paths must be globally unique within a particular store.

For example, the model:

    {
      title: 'Fruit store',
      fruits: [
        { name: 'banana', color: 'yellow' },
        { name: 'apple', color: 'red' },
        { name: 'lime', color: 'green' }
      ]
    }

Would have paths like `title`, `fruits.1`, and `fruits.0.color`. Paths consist of valid JavaScript variable names---alphanumeric characters or underscore (`_`), beginning with a letter or underscore---or array indicies joined by dots (`.`). They should not contain dollar signs (`$`), which are reserved for internal use.

#### Private paths

Paths that contain a segment starting with an underscore (e.g. `_showFooter` or `flowers.10._hovered`) have a special meaning. These paths are considered "private," and they are not synced back to the server or to other clients. Private paths are frequently used with [references](#references) and for rendering purposes.

#### GUIDs

Models provide a method to create globablly unique ids. These can be used as part of a path or within mutator methods.

> ### `guid = `model.id` ( )`
>
> **guid:** Returns a globally unique identifier that can be used for model operations

### Subscription

The `model.subscribe` method populates a model with data from its associated store and declares that this data should be kept up to date as it changes. It is possible to define subscriptions in terms of path patterns or queries.

Typically, subscriptions are set up in response to routes before rendering a page. However, the subscribe method may be called in any context on the server or in the browser. All subscriptions established before rendering the page on the server will be re-established once the page loads in the browser.

> ### model.subscribe` ( targets..., [callback] )`
>
> **targets:** One or more path patterns or queries to subscribe to
>
> **callback:** *(optional)* Called after subscription succeeds and the data is set in the model or upon an error

The subscribe callback takes the arguments `callback(err, scopedModels...)`. If the transaction succeeds, `err` is `null`. Otherwise, it is a string with an error message. This message is `'disconnected'` if Socket.IO is not currently connected. The remaining arguments are [scoped models](#scoped_models) that correspond to each subscribe target's path respectively.

If a model is already subscribed to a target, calling subscribe again for the same target will have no effect. If all targets are already subscribed, the callback will be invoked immediately.

> ### model.unsubscribe` ( [targets...], [callback] )`
>
> **targets:** *(optional)* One or more path patterns or queries to unsubscribe from. All of the model's current subscriptions will be unsubscribed if no targets are specified
>
> **callback:** *(optional)* Called after unsubscription succeeds or upon an error

The unsubscribe callback takes the argument `callback(err)`. Like subscribe, `err` is `null` when unsubscribe succeeds, and it is `'disconnected'` if Socket.IO is not currently connected.

Calling unsubscribe with no specified targets removes all subscriptions for a model. Unsubscribe removes the subscriptions, but it does not remove any data from the model.

Path patterns are specified as strings that correspond to model paths. A path pattern subscribe to the entire object, including all of its sub-paths. For example, subscribing to `rooms.lobby` subscribes to all data set under that path, such as `rooms.lobby.name` or `rooms.lobby.items.3.location`.

It is also possible to use an asterisk as a wildcard character in place of a path segment. For example, `rooms.*.playerCount` subscribes a model to the playerCount for all rooms but no other properties. The scoped model passed to a subscribe callback is scoped to the segments up to the first wildcard character. For this example, the model would be scoped to `rooms`. More complex subscriptions may be specified via [queries](#queries).

{% highlight javascript %}
var roomName = 'lobby'
model.subscribe('rooms.' + roomName, (err, room) {
  // Logs: 'rooms.lobby'
  console.log(room.path())
  // A reference is frequently created from a parameterized
  // path pattern for use later. Refs may be created directly
  // from a scoped model
  model.ref('_room', room)
})
{% endhighlight %}
{% highlight coffeescript %}
roomName = 'lobby'
model.subscribe "rooms.#{roomName}", (err, room) ->
  # Logs: 'rooms.lobby'
  console.log room.path()
  # A reference is frequently created from a parameterized
  # path pattern for use later. Refs may be created directly
  # from a scoped model
  model.ref '_room', room
{% endhighlight %}

In addition to `subscribe`, models have a `fetch` method with the same format. Like subscribe, fetch populates a model with data from a store based on path patterns and queries. However, fetch only retrieves the data once, and it does not establish any ongoing subscriptions. Fetch may be used for any data that need not be updated in realtime and avoids use of the PubSub system.

> ### model.fetch` ( targets..., callback )`
>
> **targets:** One or more path patterns or queries
>
> **callback:** Called after a fetch succeeds and the data is set in the model or upon an error

The fetch callback has the same arguments as subscribe's: `callback(err, scopedModels...)`

### Queries

Queries provide an expressive API for specifying subscriptions and getting data asynchronously. More info coming soon.

### Scoped models

Scoped models provide a more convenient way to interact with commonly used paths. They support the same methods, and they provide the path argument to accessors, mutators, and event subscribers.

> ### `scoped = `model.at` ( path, [absolute] )`
>
> **path:** The reference path to set. Note that Derby also supports supplying a DOM node instead of a path string
>
> **inputPaths:** *(optional)* Will replace the model's reference path if true. By default, the path is appended
>
> **scoped:** Returns a scoped model

> ### `scoped = `model.parent` ( [levels] )`
>
> **levels:** *(optional)* Defaults to 1. The number of path segments to remove from the end of the reference path
>
> **scoped:** Returns a scoped model

> ### `path = `model.path` ( )`
>
> **path:** Returns the reference path for the model that was set via `model.at` or `model.parent`

> ### `segment = `model.leaf` ( )`
>
> **segment:** Returns the last segment for the reference path. This may be useful for getting indicies or other properties set at the end of a path

{% highlight javascript %}
room = model.at('_room')

// These are equivalent:
room.at('name').set('Fun room')
room.set('name', 'Fun room')

// Logs: {name: 'Fun room'}
console.log(room.get())
// Logs: 'Fun room'
console.log(room.get('name'))

// Array methods can take a subpath as a first argument
// when the scoped model points to an object
room.push('toys', 'blocks', 'puzzles')
// When the scoped model points to an array, no subpath
// argument should be supplied
room.at('toys').push('cards', 'dominoes')
{% endhighlight %}
{% highlight coffeescript %}
room = model.at '_room'

# These are equivalent:
room.at('name').set 'Fun room'
room.set 'name', 'Fun room'

# Logs: {name: 'Fun room'}
console.log room.get()
# Logs: 'Fun room'
console.log room.get('name')

# Array methods can take a subpath as a first argument
# when the scoped model points to an object
room.push 'toys', 'blocks', 'puzzles'
# When the scoped model points to an array, no subpath
# argument should be supplied
room.at('toys').push 'cards', 'dominoes'
{% endhighlight %}

Note that Derby also extends `model.at` to accept a DOM node as an argument. This is typically used with `e.target` in an event callback. See [x-bind](#dom_event_binding).

### Mutators

Model mutator methods are applied optimistically. This means that changes are reflected immediately, but they may ultimately fail and be rolled back. All model mutator methods are synchronous and provide an optional callback.

#### Basic methods

These methods can be used on any model path to get, set, or delete an object.

> ### `value = `model.get` ( [path] )`
>
> **path:** *(optional)* Path of object to get. Not supplying a path will return all data in the model
>
> **value:** Current value of the object at the given path. Note that objects are returned by reference and should not be modified directly

All model mutators have an optional callback with the arguments `callback(err, methodArgs...)`. If the transaction succeeds, `err` is `null`. Otherwise, it is a string with an error message. This message is `'conflict'` if when there is a conflict with another transaction. The method arguments used to call the original function (e.g. `path, value` for the `model.set()` method) are also passed back to the callback.

> ### `previous = `model.set` ( path, value, [callback] )`
>
> **path:** Model path to set
>
> **value:** Value to assign
>
> **previous:** Returns the value that was set at the path previously
>
> **callback:** *(optional)* Invoked upon completion of a successful or failed transaction

> ### `obj = `model.del` ( path, [callback] )`
>
> **path:** Model path of object to delete
>
> **obj:** Returns the deleted object

Models allow getting and setting to nested undefined paths. Getting such a path returns `undefined`. Setting such a path first sets each undefined or null parent to an empty object.

{% highlight javascript %}
var model = store.createModel()
model.set('cars.DeLorean.DMC12.color', 'silver')
// Logs: { cars: { DeLorean: { DMC12: { color: 'silver' }}}}
console.log(model.get())
{% endhighlight %}
{% highlight coffeescript %}
model = store.createModel()
model.set 'cars.DeLorean.DMC12.color', 'silver'
# Logs: { cars: { DeLorean: { DMC12: { color: 'silver' }}}}
console.log model.get()
{% endhighlight %}

> ### `obj = `model.setNull` ( path, value, [callback] )`
>
> **path:** Model path to set
>
> **value:** Value to assign only if the path is null or undefined
>
> **obj:** Returns the object at the path if it is not null or undefined. Otherwise, returns the new value

> ### `num = `model.incr` ( path, [byNum], [callback] )`
>
> **path:** Model path to set
>
> **byNum:** *(optional)* Number specifying amount to increment or decrement if negative. Defaults to 1
>
> **num:** Returns the new value that was set after incrementing

The `model.setNull()` and `model.incr()` methods provide a more convenient way to perform common get and set combinations. Internally, they perform a `model.get()` and a `model.set()`, so the model events raised by both of these methods are `set` events and *not* `setNull` or `incr`. Note that `incr` can be called on a null path, in which case the value will be set to `byNum`.

#### Array methods

Array methods can only be used on paths set to arrays, null, or undefined. If the path is null or undefined, the path will first be set to an empty array before applying the method.

> ### `length = `model.push` ( path, items..., [callback] )`
>
> **path:** Model path to an array
>
> **items:** One or more items to add to the *end* of the array
>
> **length:** Returns the length of the array with the new items added

> ### `length = `model.unshift` ( path, items..., [callback] )`
>
> **path:** Model path to an array
>
> **items:** One items to add to the *beginning* of the array
>
> **length:** Returns the length of the array with the new items added

> ### `length = `model.insert` ( path, index, items..., [callback] )`
>
> **path:** Model path to an array
>
> **index:** Index at which to start inserting. This can also be specified by appending it to the path instead of as a separate argument
>
> **items:** One or more items to insert at the index
>
> **length:** Returns the length of the array with the new items added

> ### `item = `model.pop` ( path, [callback] )`
>
> **path:** Model path to an array
>
> **item:** Removes the last item in the array and returns it

> ### `item = `model.shift` ( path, [callback] )`
>
> **path:** Model path to an array
>
> **item:** Removes the first item in the array and returns it

> ### `removed = `model.remove` ( path, index, [howMany], [callback] )`
>
> **path:** Model path to an array
>
> **index:** Index at which to start removing items. This can also be specified by appending it to the path instead of as a separate argument
>
> **howMany:** *(optional)* Number of items to remove. Defaults to 1
>
> **removed:** Returns an array of removed items

> ### `item = `model.move` ( path, from, to, [callback] )`
>
> **path:** Model path to an array
>
> **from:** Starting index of the item to move. This can also be specified by appending it to the path instead of as a separate argument
>
> **to:** New index where the item should be moved
>
> **item:** Returns the item that was moved

#### OT methods

OT support is experimental, and it is not enabled by default. The OT plugin must be included in order to use OT methods. See the Racer [pad example](https://github.com/codeparty/racer/tree/master/examples/pad) for more info.

> ### `previous = `model.ot` ( path, value, [callback] )`
>
> **path:** Model path to initialize as an OT field
>
> **value:** A string to use as the initial value of the OT field
>
> **previous:** Returns the value that was set at the path previously

> ### `obj = `model.otNull` ( path, value, [callback] )`
>
> **path:** Model path to initialize as an OT field if the path is currently null or undefined
>
> **value:** A string to use as the initial value of the OT field
>
> **obj:** Returns the object at the path if it is not null or undefined. Otherwise, returns the new value

> ### model.otInsert` ( path, index, text, [callback] )`
>
> **path:** Model path to an OT field
>
> **index:** Position within the current OT field at which to insert
>
> **text:** String to insert

> ### `deleted = `model.otDel` ( path, index, length, [callback] )`
>
> **path:** Model path to an OT field
>
> **index:** Position within the current OT field at which to start deleting
>
> **length:** Number of characters to delete
>
> **deleted:** Returns the string that was deleted

### Events

Models inherit from the standard [Node.js EventEmitter](http://nodejs.org/docs/latest/api/events.html), and they support the same methods: `on`, `once`, `removeListener`, `emit`, etc.

#### Model mutator events

Racer emits events whenever it mutates data via `model.set`, `model.push`, etc. These events provide an entry point for an app to react to a specific data mutation or pattern of data mutations.

`model.on` and `model.once` accept a second argument for these types of events. The second argument may be a path pattern or regular expression that will filter emitted events, calling the handler function only when a mutator matches the pattern.

> ### `listener = `model.on` ( method, path, eventCallback )`
>
> **method:** Name of the mutator method - e.g., "set", "push"
>
> **path:** Pattern or regular expression matching the path being mutated
>
> **eventCallback:** Function to call when a matching method and path are mutated
>
> **listener:** Returns the listener function subscribed to the event emitter. This is the function that should be passed to `model.removeListener`

The event callback receives a number of arguments based on the path pattern and method. The arguments are:

> ### eventCallback` ( captures..., args..., out, isLocal, passed )`
>
> **captures:** The capturing groups from the path pattern or regular expression. If specifying a string pattern, a capturing group will be created for each `*` wildcard and anything in parentheses, such as `(one|two)`
>
> **args:** The arguments to the method. Note that optional arguments with a default value (such as the `byNum` argument of `model.incr`) will always be included
>
> **out:** The return value of the model mutator method
>
> **isLocal:** `true` if the model mutation was originally called on the same model and `false` otherwise
>
> **passed:** `undefined`, unless a value is specified via `model.pass`. See description below

In path patterns, wildcards (`*`) will only match a single segment in the middle of a path, but they will match a single or mutliple path segments at the end of the path. In other words, they are non-greedy in the middle of a pattern and greedy at the end of a pattern.

{% highlight javascript %}
// Matches only model.push('messages', message)
model.on('push', 'messages', function (message, messagesLength) {
  ...
})

// Matches model.set('todos.4.completed', true), etc.
model.on('set', 'todos.*.completed', function (todoId, isComplete) {
  ...
})

// Matches all set operations
model.on('set', '*', function (path, value) {
  ...
})
{% endhighlight %}
{% highlight coffeescript %}
# Matches only model.push('messages', message)
model.on 'push', 'messages', (message, messagesLength) ->
  ...

# Matches model.set('todos.4.completed', true), etc.
model.on 'set', 'todos.*.completed', (todoId, isComplete) ->
  ...

# Matches all set operations
model.on 'set', '*', (path, value) ->
  ...
{% endhighlight %}

#### model.pass

This method can be chained before calling a mutator method to pass an argument to model event listeners. Note that this value is only passed to local listeners, and it is not sent to the server or other clients.

{% highlight javascript %}
// Logs:
//   'red', undefined
//   'green', 'hi'

model.on('set', 'color', function (value, out, isLocal, passed) {
  console.log(value, passed)
})
model.set('color', 'red')
model.pass('hi').set('color', 'green')
{% endhighlight %}
{% highlight coffeescript %}
# Logs:
#   'red', undefined
#   'green', 'hi'

model.on 'set', 'color', (value, out, isLocal, passed) ->
  console.log value, passed
model.set 'color', 'red'
model.pass('hi').set 'color', 'green'
{% endhighlight %}

### Reactive functions

Reactive functions provide a simple way to update a computed value whenever one or more objects change. While model events respond to specific model methods and path patterns, reactive functions will be re-evaluated whenever any of its inputs or their properties change in any way.

> ### `out = `model.fn` ( path, inputPaths..., fn )`
>
> **path:** The location at which to create a reactive function. This must be a [private path](#private_paths), since reactive functions must be declared per model
>
> **inputPaths:** One or more paths for function inputs. The function will be called whenever one of the inputs or its sub-paths are modified
>
> **fn:** The function to evalute. The function will be called with each of its inputs as arguments
>
> **out:** Returns the result of the function

Note that reactive functions must be [pure functions](http://en.wikipedia.org/wiki/Pure_function). In other words, they must always return the same results given the same input arguments, and they must be side effect free. They should not rely on any state from a closure, and all inputs should be explicitly declared.

Reactive functions created on the server are sent to the client as a string and reinitialized when the page loads. If the output of a function is used for rendering, it should be created on the server.

{% highlight javascript %}
model.set('players', [
  {name: 'John', score: 4000}
, {name: 'Bill', score: 600}
, {name: 'Kim', score: 9000}
, {name: 'Megan', score: 3000}
, {name: 'Sam', score: 2000}
])
model.set('cutoff', 3)

// Sort the players by score and return the top X players. The
// function will automatically update the value of '_leaders' as
// players are added and removed, their scores change, and the
// cutoff value changes.
model.fn('_leaders', 'players', 'cutoff', function(players, cutoff) {
  // Note that the input array is copied with splice before sorting
  // it. The function should not modify the values of its inputs.
  return players.splice().sort(function(a, b) {
    return a.score - b.score
  }).splice(0, cutoff - 1)
})
{% endhighlight %}
{% highlight coffeescript %}
model.set 'players', [
  {name: 'John', score: 4000}
  {name: 'Bill', score: 600}
  {name: 'Kim', score: 9000}
  {name: 'Megan', score: 3000}
  {name: 'Sam', score: 2000}
]
model.set 'cutoff', 3

# Sort the players by score and return the top X players. The
# function will automatically update the value of '_leaders' as
# players are added and removed, their scores change, and the
# cutoff value changes.
model.fn '_leaders', 'players', 'cutoff', (players, cutoff) ->
  # Note that the input array is copied with splice before sorting
  # it. The function should not modify the values of its inputs.
  players.splice().sort((a, b) -> a.score - b.score)
    .splice(0, cutoff - 1)
{% endhighlight %}

### References

References make it possible to write business logic and templates that interact with the model in a general way. They redirect model operations from a reference path to the underlying data, and they set up event listeners that emit model events on both the reference and the actual object's path.

References must be declared per model, since calling `model.ref` creates a number of event listeners in addition to setting a ref object in the model. When a reference is created, a `set` model event is emitted. Internally, `model.set` is used to add the reference to the model.

> ### `fn = `model.ref` ( path, to, [key] )`
>
> **path:** The location at which to create a reference. This must be a [private path](#private_paths), since references must be declared per model
>
> **to:** The location that the reference links to. This is where the data is actually stored. May be a path or scoped model
>
> **key:** *(optional)* A path whose value should be added as an additional property underneath `to` when accessing the reference. May be a path or scoped model
>
> **fn:** Returns the function that is stored in the model to represent the reference. This function should not be used directly

{% highlight javascript %}
model.set('colors', {
  red: {hex: '#f00'}
, green: {hex: '#0f0'}
, blue: {hex: '#00f'}
});

// Getting a reference returns the referenced data
model.ref('_green', 'colors.green')
// Logs {hex: '#0f0'}
console.log(model.get('_green'))

// Setting a property of the reference path modifies
// the underlying data
model.set('_green.rgb', [0, 255, 0])
// Logs {hex: '#0f0', rgb: [0, 255, 0]}
console.log(model.get('colors.green'))

// Setting or deleting the reference path modifies
// the reference and not the underlying data
model.del('_green')
// Logs undefined
console.log(model.get('_green'))
// Logs {hex: '#0f0', rgb: [0, 255, 0]}
console.log(model.get('colors.green'))

// Changing a reference key updates the reference
model.set('selected', 'red')
model.ref('_selectedColor', 'colors', 'selected')
// Logs '#f00'
console.log(model.get('_selectedColor.hex'))
model.set('selected', 'blue')
// Logs '#00f'
console.log(model.get('_selectedColor.hex'))
{% endhighlight %}
{% highlight coffeescript %}
model.set 'colors'
  red: {hex: '#f00'}
  green: {hex: '#0f0'}
  blue: {hex: '#00f'}

# Getting a reference returns the referenced data
model.ref '_green', 'colors.green'
# Logs {hex: '#0f0'}
console.log model.get('_green')

# Setting a property of the reference path modifies
# the underlying data
model.set '_green.rgb', [0, 255, 0]
# Logs {hex: '#0f0', rgb: [0, 255, 0]}
console.log model.get('colors.green')

# Setting or deleting the reference path modifies
# the reference and not the underlying data
model.del '_green'
# Logs undefined
console.log model.get('_green')
# Logs {hex: '#0f0', rgb: [0, 255, 0]}
console.log model.get('colors.green')

# Changing a reference key updates the reference
model.set 'selected', 'red'
model.ref '_selectedColor', 'colors', 'selected'
# Logs '#f00'
console.log model.get('_selectedColor.hex')
model.set 'selected', 'blue'
# Logs '#00f'
console.log model.get('_selectedColor.hex')
{% endhighlight %}

Racer also supports a special reference type created via `model.refList`. This type of reference is useful when a number of objects need to be rendered or manipulated as a list even though they are stored as properties of another object. A reference list supports the same mutator methods as an array, so it can be bound in a view template just like an array.

> ### `fn = `model.refList` ( path, to, key )`
>
> **path:** The location at which to create a reference list. This must be a [private path](#private_paths), since references must be declared per model
>
> **to:** The location of an object that has properties to be mapped onto an array. Each property must be an object with a unique `id` property of the same value. May be a path or scoped model
>
> **key:** A path whose value is an array of ids that map the `to` object's properties to a given order. May be a path or scoped model
>
> **fn:** Returns the function that is stored in the model to represent the reference. This function should not be used directly

{% highlight javascript %}
// refLists may only consist of objects with an id that matches
// their property on their parent
model.set('colors', {
  red: {hex: '#f00', id: 'red'}
, green: {hex: '#0f0', id: 'green'}
, blue: {hex: '#00f', id: 'blue'}
})
model.set('_colorIds', ['blue', 'red'])
model.ref('_myColors', 'colors', '_colorIds')

model.push('_myColors', {hex: '#ff0', id: 'yellow'})

// Logs: [
//   {hex: '#00f', id: 'blue'},
//   {hex: '#f00', id: 'red'},
//   {hex: '#ff0', id: 'yellow'}
// ]
console.log(model.get('_myColors'))
{% endhighlight %}
{% highlight coffeescript %}
# refLists may only consist of objects with an id that matches
# their property on their parent
model.set 'colors',
  red: {hex: '#f00', id: 'red'}
  green: {hex: '#0f0', id: 'green'}
  blue: {hex: '#00f', id: 'blue'}
model.set '_colorIds', ['blue', 'red']
model.ref '_myColors', 'colors', '_colorIds'

model.push '_myColors', {hex: '#ff0', id: 'yellow'}

# Logs: [
#   {hex: '#00f', id: 'blue'},
#   {hex: '#f00', id: 'red'},
#   {hex: '#ff0', id: 'yellow'}
# ]
console.log model.get('_myColors')
{% endhighlight %}

Note that if objects are added to a refList without an `id` property, a unique id from [`model.id()`](#guids) will be automatically added to the object.
