import { util } from 'racer';

import { Derby } from './Derby';


const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : Derby;
console.log('class', DerbyClass);
export = new DerbyClass();
