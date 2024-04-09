import { util } from 'racer';

import { type AppOptions } from './App';
import { Derby, type DerbyBase } from './Derby';

export { type App, type AppBase } from './App';
export { type AppForServer } from './AppForServer';
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
  : Derby;
const instance: DerbyBase = new DerbyClass();

export function createApp(name?: string, file?: string, options?: AppOptions) {
  return instance.createApp(name, file, options);
}

export function use<T = unknown>(plugin: (derby: Derby, options?: T) => Derby, options?: T) {
  return instance.use(plugin, options);
}

export {
  Derby,
  instance,
  util,
}
