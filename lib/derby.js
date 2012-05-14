var path = require('path')
  , racer = require('racer')
  , View = require('./View')
  , derby = module.exports = Object.create(racer)
  , derbyPlugin = racer.util.isServer ?
      __dirname + '/derby.server' : require('./derby.browser');

// Allow derby object to be targeted via plugin.decorate
racer._makePlugable('derby', derby);

// Shared methods for both server and browser
derby._libraries = {};
derby.createLibrary = createLibrary;

// Add appropriate server-side or browser-side methods
derby.use(derbyPlugin);

function createLibrary(filename, scripts, options) {
  if (!options) options = {};
  var root = path.dirname(filename)
    , name = options.name || path.basename(root)
    , view = new View;

  this._libraries[name] = {
    root: root
  , view: view
  , scripts: scripts
  };
}
