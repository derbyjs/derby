/*
 * Derby.js
 * Meant to be the entry point for the framework.
 *
 */
import racer = require('racer');

import { App } from './App';
import components = require('./components');
import Page = require('./Page');

export class Derby extends racer {
  App = App;
  Page = Page;
  Component = components.Component;

  createApp(name: string, filename: string, options) {
    return new this.App(this, name, filename, options);
  }
}

if (!racer.util.isServer) {
  module.require('./documentListeners').add(document);
}
