var Derby = require('./Derby');
var cluster = require('cluster');

// Extend template types with html parsing on server
require('derby-parsing');

Derby.prototype.run = function(createServer) {
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
