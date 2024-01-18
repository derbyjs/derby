/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */

import { Racer, util, type Model} from 'racer';

import { App, type AppBase } from './App';
import { Component } from './components';
import { PageForClient } from './Page';

export abstract class DerbyBase extends Racer {
  Component = Component;
  // App: typeof AppBase;
  // Page: typeof PageBase;
  Model: typeof Model;
  abstract createApp(name: string, filename: string, options): AppBase
}

export class Derby extends DerbyBase {
  App = App;
  Page = PageForClient;
  Model: typeof Model;

  createApp(name: string, filename: string, options) {
    return new this.App(this, name, filename, options);
  }
}

if (!util.isServer) {
  module.require('./documentListeners').add(document);
}
