// import as namespace to avoid transform as cluster.default 
import * as cluster from 'node:cluster';

const isProduction = process.env.NODE_ENV === 'production';

export function run(createServer: () => void) {
  // In production
  if (isProduction) return createServer();
  // @ts-expect-error imported without default; need type update?
  if (cluster.isPrimary) {
    console.log('Primary PID ', process.pid);
    startWorker();
  } else {
    createServer();
  }
}

function startWorker() {
  // @ts-expect-error imported without default; need type update?
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
