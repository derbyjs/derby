var serverRequire = require('racer').util.serverRequire;
var Derby = serverRequire(module, './lib/DerbyForServer') || require('./lib/Derby');
module.exports = new Derby();
