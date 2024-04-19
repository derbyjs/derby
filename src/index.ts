import { util } from 'racer';

import { type AppOptions } from './App';
import { DerbyForClient, type Derby } from './Derby';

export { AppForClient, App } from './App';
export { AppForServer } from './AppForServer';
export { Dom } from './Dom';
export { Page, PageForClient } from './Page';
export { PageForServer } from './PageForServer';
export {
  Component,
  ComponentModelData,
  type ComponentConstructor,
  type ComponentViewDefinition,
} from './components';
export { type Context } from './templates/contexts';
export { type PageParams, type QueryParams } from './routes';

const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : DerbyForClient;
const instance: Derby = new DerbyClass();

export function createApp(name?: string, file?: string, options?: AppOptions) {
  return instance.createApp(name, file, options);
}

export function use<T = unknown>(plugin: (derby: Derby, options?: T) => Derby, options?: T) {
  return instance.use(plugin, options);
}

export {
  DerbyForClient as Derby,
  util,
}
