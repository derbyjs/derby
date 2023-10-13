import cluster from 'cluster';

const isProduction = process.env.NODE_ENV === 'production';

export function run(createServer: () => void) {
  // In production
  if (isProduction) return createServer();
  if (cluster.isPrimary) {
    console.log('Primary PID ', process.pid);
    startWorker();
  } else {
    createServer();
  }
}

function startWorker() {
  const worker = cluster.fork();
  
  worker.once('disconnect', function () {
    worker.process.kill();
  });

  worker.on('message', function(message) {
    if (message.type === 'reload') {
      if (worker.isDead()) return;
      console.log('Killing %d', worker.process.pid);
      worker.process.kill();
      startWorker();
    }
  });
}
