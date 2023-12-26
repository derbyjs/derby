---
layout: default
title: Apps
---

# Derby Apps

Derby projects support one or more single-page apps.
Apps have a full MVC structure, including a model provided by
[Racer](https://github.com/derbyjs/racer), a template and styles based view, and controller
code with application logic and routes (which map URLs to actions).

On the server, apps provide a router middleware for Express. One or more app
routers as well as server only routes can be included in the same Express
server.

Derby packages up all of an app's templates, routes, and application code when
rendering. Regardless of which app URL the browser requests initially, the app
is able to render any other state within the same application client-side. If
the app cannot handle a URL, it will fall through and request from the server.
Errors thrown during route handling also cause requests to fall through to the
server.

Derby works great with only a single app, though developers may wish to create
separate apps if only certain sets of pages are likely to be used together. For
example, a project might have a separate desktop web app and mobile web app. Or
a project might have an internal administration panel app and a public content
app.


## Creating apps

Apps are created in the file that defines the app's controller code. They are
then associated with a server by requiring the app within the server file.

> `app = derby.createApp ( name, fileName )`
>
> * `name`: the name of the app
> * `fileName`: the name of the file, typically node's default __filename is used.
>
> * `app`: Returns an app object, typically exported as `module.exports = app`


App names are used to automatically associate an app with template and styles files of the same
name.

The `createApp` method adds a number of methods to the app. On both the client
and the server, these are `use`, `get`, `post`, `put`, `del`,
and `ready`. On the server only, Derby also adds `router`,
for use with Express.

## Connecting servers to apps

Because Derby shares most code between server and client, Derby server files
can be very minimal.

The server includes an app with a standard Node.js require statement. It can
then use the `app.router()` method to create a router middleware for Express
that handles all of the app's routes.

The server also needs to create a `store` object, which is what creates models,
coordinates data syncing, and interfaces with databases. Stores are created via
the `derby.createStore()` method. See [Backends](models/backends).

> A typical setup can be seen in the [derby-starter](https://github.com/derbyjs/derby-starter/blob/master/lib/server.js) project, which is a node module for getting started with Derby.
>
> The [derby-examples](https://github.com/derbyjs/derby-examples) make use of derby-starter to setup their apps.
