var serverRequire = require('racer').util.serverRequire;
var Derby = serverRequire(module, './DerbyForServer') || require('./Derby').Derby;
module.exports = new Derby();
