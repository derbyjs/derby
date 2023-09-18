var cluster = require('cluster');
var Derby = require('./Derby').Derby;
var util = require('racer/lib/util');

util.isProduction = process.env.NODE_ENV === 'production';

module.exports = DerbyForServer;
function DerbyForServer() {}
DerbyForServer.prototype = Object.create(Derby.prototype);
DerbyForServer.prototype.constructor = DerbyForServer;

DerbyForServer.prototype.App = require('./AppForServer');
DerbyForServer.prototype.Page = require('./PageForServer');

DerbyForServer.prototype.run = function(createServer) {
  // In production
  if (this.util.isProduction) return createServer();
  if (cluster.isMaster) {
    console.log('Master pid ', process.pid);
    startWorker();
  } else {
    createServer();
  }
};

function startWorker() {
  var worker = cluster.fork();
  worker.once('disconnect', function () {
    worker.process.kill();
  });
  worker.on('message', function(message) {
    if (message.type === 'reload') {
      if (worker.disconnecting) return;
      console.log('Killing %d', worker.process.pid);
      worker.process.kill();
      worker.disconnecting = true;
      startWorker();
    }
  });
}
