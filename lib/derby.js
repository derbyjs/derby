var racer = require('racer')
  , component = require('./component')
  , derby = module.exports = Object.create(racer)
  , derbyPlugin = racer.util.isServer ?
      __dirname + '/derby.server' : require('./derby.browser');

// Allow derby object to be targeted via plugin.decorate
racer._makePlugable('derby', derby);

derby
  // Shared methods
  .use(component)
  // Server-side or browser-side methods
  .use(derbyPlugin);
