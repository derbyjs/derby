var path = require('path')
  , racer = require('racer')
  , View = require('./View')
  , derby = module.exports = Object.create(racer)
  , derbyPlugin = racer.util.isServer ?
      __dirname + '/derby.server' : require('./derby.browser');

// Allow derby object to be targeted via plugin.decorate
racer._makePlugable('derby', derby);

// Shared methods for both server and browser
var libraries = derby._libraries = {};
derby.createLibrary = createLibrary;

// Add appropriate server-side or browser-side methods
derby.use(derbyPlugin);


function createLibrary(config, options) {
  if (!config || !config.filename) {
    throw new Error ('Configuration argument with a filename is required');
  }
  if (!options) options = {};
  var root = path.dirname(config.filename)
    , ns = options.ns || config.ns || path.basename(root)
    , scripts = config.scripts || {}
    , view = new View;

  // This is needed, since component names are all lowercased
  for (scriptName in scripts) {
    scripts[scriptName.toLowerCase()] = scripts[scriptName];
  }

  libraries[ns] = {
    root: root
  , view: view
  , scripts: scripts
  , styles: config.styles
  };
}
