var serverRequire = require('racer').util.serverRequire;

var derbyServer = serverRequire(module, './DerbyForServer');
var derbyClient = require('./Derby');
var Derby = derbyServer ? derbyServer.DerbyForServer : derbyClient.Derby;
module.exports = new Derby();
