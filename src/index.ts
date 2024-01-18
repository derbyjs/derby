import { util } from 'racer';

import { Derby, type DerbyBase } from './Derby';


const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : Derby;
console.log('class', DerbyClass);
const instance: DerbyBase = new DerbyClass();

export {
  Derby,
  instance,
}
