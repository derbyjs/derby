import { Derby } from './Derby';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const util = require('racer').util;

const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : Derby;
export = new DerbyClass();
