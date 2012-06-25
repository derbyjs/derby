var racer = require('racer')
  , createLibrary = require('./component').createLibrary
  , derby = module.exports = Object.create(racer)
  , derbyPlugin = racer.util.isServer ?
      __dirname + '/derby.server' : require('./derby.browser');

// Allow derby object to be targeted via plugin.decorate
racer._makePlugable('derby', derby);

// Shared methods for both server and browser
derby.createLibrary = createLibrary;

// Add appropriate server-side or browser-side methods
derby.use(derbyPlugin);
