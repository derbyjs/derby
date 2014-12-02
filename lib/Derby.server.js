var cluster = require('cluster');
var Derby = require('./Derby');
var util = require('racer/lib/util');

var debugPortDelta = 0;

// Extend template types with html parsing on server
require('derby-parsing');

util.isProduction = process.env.NODE_ENV === 'production';

Derby.prototype.run = function(createServer) {
  // In production
  if (this.util.isProduction) return createServer();
  if (cluster.isMaster) {
    cluster.setupMaster({
      execArgv: []
    });
    console.log('Master pid ', process.pid);
    startWorker();
  } else {
    createServer();
  }
};

function startWorker() {
  // make it possible to debug forked processes
  var debugIdx = process.execArgv.indexOf('--debug');
  if (debugIdx >= 0)
    cluster.settings.execArgv[debugIdx] = '--debug=' + (5859 + debugPortDelta++);

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
