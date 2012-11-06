// This is the main module of a Derby package.
//
// It exports *derby object* which is prototyped from the *racer object* and
// extended using two base plugins.
//
// See [racer module](../racer/racer.html) for details about prototype of a
// *derby object*.

var racer = require('racer')
  , component = require('./component')
  , derby = module.exports = Object.create(racer)
  , derbyPlugin = racer.util.isServer ?
      __dirname + '/derby.server' : require('./derby.browser');

// ## Extending *derby object* using plugins
//
// As said above, the *derby object* is extended using two *base* plugins.
//
// The first one is a plugin responsible for handling *compoment libraries*.
// This plugin is common for both server and browser environments.
//
// The second one extends *derby object* with methods for creating and
// initializing application. That plugin is implemented differently for each
// environment; see [`derby.server`](derby.server.html) and
// [`derby.browser`](derby.browser.html) for details.

/* Allow derby object to be pluggable using racer's plugin pattern. */
racer._makePlugable('derby', derby);

derby
  .use(component) // Shared methods
  .use(derbyPlugin); // Server-side or browser-side methods
