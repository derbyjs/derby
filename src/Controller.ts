import { EventEmitter } from 'events';

import { DefualtType, type ChildModel } from 'racer';

import { type AppBase } from './App';
import { type ComponentModelData } from './components';
import { Dom }  from './Dom';
import { Page } from './Page';

export class Controller<T = DefualtType> extends EventEmitter {
  dom: Dom;
  app: AppBase;
  page: Page;
  model: ChildModel<T>;
  markerNode: Node;

  constructor(app: AppBase, page: Page, model: ChildModel<T>) {
    super();
    this.dom = new Dom(this);
    this.app = app;
    this.model = model;
    this.page = page;
    (model.data as ComponentModelData).$controller = this;
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
