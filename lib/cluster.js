var cluster = require('cluster')
  , http = require('http')

module.exports = {
  run: run
};

function run(filename, port) {
  if (cluster.isMaster) {
    console.log('master pid', process.pid);
    startWorker();
  } else {
    var server = requireServer(filename);
    server.listen(port, function() {
      console.log(process.pid + ' listening');
      console.log('Go to: http://localhost:%d/', port);
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
      console.log('Reloading...')
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
