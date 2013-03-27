var cluster = require('cluster')
  , http = require('http')

module.exports = {
  run: run
};

function run(filename, port) {
  if (cluster.isMaster && !process.env.DEBUGGER) {
    console.log('Master pid', process.pid);
    startWorker();
  } else {
    var server = requireServer(filename);
    server.listen(port, function() {
      console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
    });
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

function requireServer(filename) {
  try {
    var server = require(filename);
  } catch (e) {
    console.error('Error requiring server module from `%s`', filename);
    throw e;
  }
  if (!(server instanceof http.Server)) {
    throw new Error('`' + filename + '` does not export a valid `http.Server`');
  }
  return server;
}
