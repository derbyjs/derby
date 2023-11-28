/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */

import { App, type AppBase } from './App';
import { Component } from './components';
import { Page } from './Page';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const racer = require('racer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Racer = require('racer/lib/Racer');

export abstract class DerbyBase extends Racer {
  Component = Component;
  abstract createApp(name: string, filename: string, options): AppBase
}

export class Derby extends DerbyBase {
  App = App;
  Page = Page;
  Model: typeof racer.Model;

  createApp(name: string, filename: string, options) {
    return new this.App(this, name, filename, options);
  }

  use(plugin, options) {
    return racer.util.use.call(this, plugin, options);
  }

  serverUse(plugin, options) {
    return racer.util.serverUse.call(this, plugin, options);
  }
}

if (!racer.util.isServer) {
  module.require('./documentListeners').add(document);
}
