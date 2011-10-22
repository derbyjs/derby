# Derby

Derby is an MVC framework for writing realtime, collaborative Node.js apps. You write HTML templates, routes, and business logic; Derby creates an Express server and Socket.IO-connected web app that synchronize all users in realtime.

### hello.js

    var hello = require('derby').createApp(module),
        get = hello.get,
        view = hello.view;
    
    // Views define both HTML rendering and model <--> view bindings
    view.make('Body', '<input value="((message))">');

    // Routes render on client as well as server
    get('/', function (page, model) {
      // Subscribe specifies the data to sync
      model.subscribe('message', function () {
        // Model changes sync automatically
        model.setNull('message', 'Howdy, neighbor!');
        page.render();
      });
    });

### server.js

    var express = require('express'),
        hello = require('./hello'),
        server = express.createServer(
          express.static(__dirname + '/public'),
          // Apps create an Express middleware
          hello.router()
        ),
        // Apps also create a server-side store for syncing data
        store = hello.createStore({ listen: server });
    
    server.listen(3000);

## Instant by default

Derby apps are instant loading, instant updating, multi-user, and offline-capable by default. Here's how it works:

  * HTML templates: Mustache-like templates are rendered into HTML on both the server and client. Because pages render on the server, the app displays immediately, even before any scripts are downloaded.
  * View bindings: In addition to HTML rendering, templates specify live bindings between the view and model. When the model data changes, the view updates the property, text, or HTML neccessary to reflect the new data. When the user interacts with the page--such as editing the value of a text input--the model data is updated.
  * Model syncing: Model changes are automatically sychronized with the server and all clients that are subscribed to the same data. Clients send their updates to the server as transactions.
  * Conflict resolution: The server detects conflicts, enabling clients to respond instantly and work offline. Multiple powerful techniques for conflict resolution are included.
  * Client and server routing: The same routes specify a single page app in the browser and a traditional REST server app. In a modern browser, the app transforms URLs into instantly rendered push/pop state changes, while the app remains accessible via server rendering for search engines and browsers without JavaScript.

