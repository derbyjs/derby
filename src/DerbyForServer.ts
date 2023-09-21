import cluster from 'cluster';

import { AppForServer } from './AppForServer';
import { DerbyBase } from './Derby';
import { PageForServer } from './PageForServer';

const isProduction = process.env.NODE_ENV === 'production';

export class DerbyForServer extends DerbyBase {
  App = AppForServer;
  Page = PageForServer;

  createApp(name: string, filename: string, options) {
    return new this.App(this, name, filename, options);
  }

  run = function(createServer) {
    // In production
    if (isProduction) return createServer();
    if (cluster.isPrimary) {
      console.log('Primary PID ', process.pid);
      startWorker();
    } else {
      createServer();
    }
  };
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
