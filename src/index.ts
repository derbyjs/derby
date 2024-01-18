import { util } from 'racer';

import { type App } from './App';
import { Derby, type DerbyBase } from './Derby';
import { type Page } from './Page';
import { type PageParams } from './routes';

const DerbyClass = util.isServer
  ? util.serverRequire(module, './DerbyForServer').DerbyForServer
  : Derby;
console.log('class', DerbyClass);
const instance: DerbyBase = new DerbyClass();

const { Component } = instance;

export {
  App,
  Component,
  Derby,
  instance,
  Page,
  PageParams,
}
