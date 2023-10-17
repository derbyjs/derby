import { util } from 'racer';

import { AppBase as AppClass, type App } from './App';
import { type AppForServer } from './AppForServer';
import { PageBase as PageClass } from './Page';

/* eslint-disable @typescript-eslint/no-var-requires */
if (util.isServer) {
  // @ts-expect-error Required tomfoolery for isomorphic things
  AppClass = require('./App').App;
  // @ts-expect-error Required tomfoolery for isomorphic things
  PageClass = require('./Page').Page;
} else {
  // @ts-expect-error Required tomfoolery for isomorphic things
  AppClass = require('./AppForServer').AppForServer;
  // @ts-expect-error Required tomfoolery for isomorphic things
  PageClass = require('./PageForServer').PageForServer;
}
/* eslint-enable @typescript-eslint/no-var-requires */

export { Component } from './components';
export { AppClass as App };
export { PageClass as Page };
export { type PageParams, type QueryParams } from './routes';
export { Dom } from './Dom';

export function createApp(name: string, filename: string, options) {
  if (util.isServer) {
    return new (AppClass as unknown as typeof AppForServer)({ Page: PageClass }, name, filename, options);
  } else {
    return new (AppClass as unknown as typeof App)({ Page: PageClass }, name, filename, options);
  }
}

