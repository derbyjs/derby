var racer = require('racer');
var derby = module.exports = Object.create(racer);

var derbyPlugin = (racer.util.isServer) ?
  __dirname + '/derby.server' :
  require('./derby.browser');

// TODO: Remove or implement
derby.get = function() {}

derby
  // Server-side or browser-side methods
  .use(derbyPlugin);
