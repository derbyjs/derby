import { EventEmitter } from 'events';

import { type Model } from 'racer';

import { type AppBase } from './App';
import Dom = require('./Dom');
import { PageBase } from './Page';

export class Controller<T = object> extends EventEmitter {
  dom: Dom;
  app: AppBase;
  page: PageBase;
  model: Model<T>;
  markerNode: Node;

  constructor(app: AppBase, page: PageBase, model: Model) {
    super();
    this.dom = new Dom(this);
    this.app = app;
    this.model = model;
    this.page = page;
    model.data.$controller = this;
  }

  emitCancellable(...args: unknown[]) {
    let cancelled = false;
    function cancel() {
      cancelled = true;
    }

    args.push(cancel);
    // eslint-disable-next-line prefer-spread
    this.emit.apply(this, args);

    return cancelled;
  }

  emitDelayable(...args: unknown[]) {
    const callback: () => void = args.pop() as any;

    let delayed = false;
    function delay() {
      delayed = true;
      return callback;
    }

    args.push(delay);
    // eslint-disable-next-line prefer-spread
    this.emit.apply(this, args);
    if (!delayed) callback();

    return delayed;
  }
}
