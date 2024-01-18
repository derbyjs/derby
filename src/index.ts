import { util } from 'racer';

import { Derby, type DerbyBase } from './Derby';
import { type Page } from './Page';

const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : Derby;
console.log('class', DerbyClass);
const instance: DerbyBase = new DerbyClass();

const { Component } = instance;

export {
  // App,
  Component,
  Derby,
  instance,
  Page,
}
