import { util } from 'racer';

import { App } from './App';
import { AppForServer } from './AppForServer';
import { Derby } from './Derby';
import { PageForServer } from './PageForServer';

util.isProduction = process.env.NODE_ENV === 'production';

export class DerbyForServer extends Derby {
  App = AppForServer;
  Page = PageForServer;

  createApp(name: string, filename: string, options: any): App {
    return new this.App(this, name, filename, options);
  }
}
