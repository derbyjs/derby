var http = require('http');
var Derby = require('./Derby');
var derbyCluster = require('./cluster');

// Extend template types with html parsing on server
require('derby-html-parser');

Derby.prototype.run = function(server, port, cb) {
  if (port == null) {
    port = process.env.PORT || (this.util.isProduction ? 80 : 3000);
  }
  function listenCallback(err) {
    console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
    cb && cb(err);
  }
  function createServer() {
    if (typeof server === 'string') server = require(server);
    if (typeof server === 'function') server = http.createServer(server);
    server.listen(port, listenCallback);
  }
  if (this.util.isProduction) return createServer();
  derbyCluster.run(createServer);
};
