/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */
import { Racer, util } from 'racer';

import { App, type AppBase, type AppOptions } from './App';
import { Component } from './components';
import { PageForClient } from './Page';

export abstract class DerbyBase extends Racer {
  Component = Component;
  // App: typeof AppBase;
  // Page: typeof PageBase;
  abstract createApp(name?: string, filename?: string, options?: AppOptions): AppBase
}

export class Derby extends DerbyBase {
  App = App;
  Page = PageForClient;

  createApp(name?: string, filename?: string, options?: AppOptions) {
    return new this.App(this, name, filename, options);
  }
}

if (!util.isServer) {
  module.require('./documentListeners').add(document);
}
