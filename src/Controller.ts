import { EventEmitter } from 'events';

import Dom = require('./Dom');

export class Controller extends EventEmitter {
  dom: Dom;
  app: any;
  page: any;
  model: any;

  constructor(app, page, model) {
    super();
    this.dom = new Dom(this);
    this.app = app;
    this.page = page;
    this.model = model;
    model.data.$controller = this;
  }

  emitCancellable(...args) {
    let cancelled = false;
    function cancel() {
      cancelled = true;
    }

    args.push(cancel);
    this.emit.apply(this, ...args);

    return cancelled;
  }

  emitDelayable(...args) {
    const callback = args.pop();

    let delayed = false;
    function delay() {
      delayed = true;
      return callback;
    }

    args.push(delay);
    this.emit.apply(this, ...args);
    if (!delayed) callback();

    return delayed;
  }
}
