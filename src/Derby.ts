/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */
import racer = require('racer');
import Racer = require('racer/lib/Racer');

import { App, type AppBase } from './App';
import { Component } from './components';
import { Page } from './Page';

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
}

if (!racer.util.isServer) {
  module.require('./documentListeners').add(document);
}
