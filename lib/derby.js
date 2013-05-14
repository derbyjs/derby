var racer = require('racer');
var derby = module.exports = Object.create(racer);

var component = require('./component');
var derbyPlugin = (racer.util.isServer) ?
  __dirname + '/derby.server' :
  require('./derby.browser');

// TODO: Remove or implement
derby.get = function() {}

derby
  // Shared methods
  .use(component)
  // Server-side or browser-side methods
  .use(derbyPlugin);
