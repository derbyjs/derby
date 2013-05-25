var cluster = require('cluster')

module.exports = {
  run: run
};

function run(server, port, cb) {
  if (cluster.isMaster) {
    console.log('Master pid ', process.pid);
    startWorker();
  } else {
    server.listen(port, cb);
  }
}

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
