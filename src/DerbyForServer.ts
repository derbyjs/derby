import { AppBase } from './App';
import { AppForServer } from './AppForServer';
import { DerbyBase } from './Derby';
import { PageForServer } from './PageForServer';

export class DerbyForServer extends DerbyBase {
  App: typeof AppForServer = AppForServer;
  Page: typeof PageForServer = PageForServer;

  createApp(name: string, filename: string, options: any): AppBase {
    return new this.App(this, name, filename, options);
  }
}
