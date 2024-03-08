import { util } from 'racer';

import { Derby, type DerbyBase } from './Derby';

export { type App } from './App';
export { Page, PageForClient } from './Page';
export { PageForServer } from './PageForServer';
export {
  Component,
  ComponentModelData,
  type ComponentConstructor,
  type ComponentViewDefinition,
} from './components';
export { type Context } from './templates/contexts';
export { type PageParams } from './routes';

const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : Derby;
const instance: DerbyBase = new DerbyClass();

export {
  Derby,
  instance,
  util,
}
