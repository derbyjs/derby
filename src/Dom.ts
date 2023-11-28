import { type Controller } from './Controller';

type ListenerFn<K extends keyof EventMap> = K extends 'destroy'
  ? () => void
  : (event: EventMap[K]) => void;

interface EventMap extends DocumentEventMap {
  'destroy': never;
}

export class Dom {
  controller: Controller;
  _listeners: DomListener<keyof EventMap>[];

  constructor(controller) {
    this.controller = controller;
    this._listeners = null;
  }

  _initListeners() {
    this.controller.on('destroy', () => {
      const listeners = this._listeners;
      if (!listeners) return;
      for (let i = listeners.length; i--;) {
        listeners[i].remove();
      }
      this._listeners = null;
    });
    return this._listeners = [];
  }

  _listenerIndex(domListener) {
    const listeners = this._listeners;
    if (!listeners) return -1;
    for (let i = listeners.length; i--;) {
      if (listeners[i].equals(domListener)) return i;
    }
    return -1;
  }

  /**
   * Adds a DOM event listener that will get cleaned up when this component is cleaned up.
   *
   * @param type - Name of the DOM event to listen to
   * @param target - Optional target to add the DOM listener to. If not provided, the target is `document`.
   * @param listener - Listener to be called when the DOM event occurs
   * @param useCapture - Optional, defaults to false. If true, add the listener as a capturing listener.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
   */
  addListener<K extends keyof EventMap>(
    type: K,
    target: EventTarget,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  addListener<K extends keyof EventMap>(
    type: K,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  addListener<K extends keyof EventMap>(
    type: K,
    target: EventTarget | (ListenerFn<K>),
    listener?: (ListenerFn<K>) | boolean,
    useCapture?: boolean,
  ): void {
    if (typeof target === 'function') {
      useCapture = !!(listener as boolean);
      listener = target as ListenerFn<K>;
      target = document;
    }
    const domListener = (type === 'destroy')
      ? new DestroyListener(target, listener as ListenerFn<'destroy'>)
      : new DomListener(type, target, listener as ListenerFn<K>, useCapture);
    if (-1 === this._listenerIndex(domListener)) {
      const listeners = this._listeners || this._initListeners();
      listeners.push(domListener);
    }
    domListener.add();
  }

  /**
   * Adds a DOM event listener that will get cleaned up when this component is cleaned up.
   *
   * @param type - Name of the DOM event to listen to
   * @param target - Optional target to add the DOM listener to. If not provided, the target is `document`.
   * @param listener - Listener to be called when the DOM event occurs
   * @param useCapture - Optional, defaults to false. If true, add the listener as a capturing listener.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
   */
  on<K extends keyof EventMap>(
    type: K,
    target: EventTarget,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  on<K extends keyof EventMap>(
    type: K,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  on<K extends keyof EventMap>(
    type: K,
    target: EventTarget | (ListenerFn<K>),
    listener?: (ListenerFn<K>) | boolean,
    useCapture?: boolean,
  ): void {
    if (typeof target === 'function') {
      listener = target as ListenerFn<K>;
      target = document;
    }
    this.addListener(type, target, listener as ListenerFn<K>, useCapture);
  }

  /**
   * Adds a one-time DOM event listener that will get cleaned up when this component is cleaned up.
   *
   * @param type - Name of the DOM event to listen to
   * @param target - Optional target to add the DOM listener to. If not provided, the target is `document`.
   * @param listener - Listener to be called when the DOM event occurs
   * @param useCapture - Optional, defaults to false. If true, add the listener as a capturing listener.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
   */
  once<K extends keyof EventMap>(
    type: K,
    target: EventTarget,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  once<K extends keyof EventMap>(
    type: K,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  once<K extends keyof EventMap>(
    type: K,
    target: EventTarget | (ListenerFn<K>),
    listener?: (ListenerFn<K>) | boolean,
    useCapture?: boolean,
  ): void {
    if (typeof target === 'function') {
      useCapture = !!(listener);
      listener = target as ListenerFn<K>;
      target = document;
    }
    const wrappedListener = ((...args) => {
      this.removeListener(type, target as EventTarget, wrappedListener, useCapture);
      return (listener as ListenerFn<K>).apply(this, args);
    }) as ListenerFn<K>;
    this.addListener(type, target, wrappedListener, useCapture);
  }

  /**
   * Removes a DOM event listener that was added via `#addListener`, `#on`, or `#once`, using the same
   * parameters as those methods.
   *
   * @param type - Name of the DOM event
   * @param target - Optional target for the DOM listener. If not provided, the target is `document`.
   * @param listener - Listener function that was passed to  `#addListener`, `#on`, or `#once`.
   * @param useCapture - Optional, defaults to false. If true, removes a capturing listener.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
   */
  removeListener<K extends keyof EventMap>(
    type: K,
    target: EventTarget,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  removeListener<K extends keyof EventMap>(
    type: K,
    listener: ListenerFn<K>,
    useCapture?: boolean
  ): void;
  removeListener<K extends keyof EventMap>(
    type: K,
    target: EventTarget | ListenerFn<K>,
    listener?: (ListenerFn<K>) | boolean,
    useCapture?: boolean,
  ): void {
    if (typeof target === 'function') {
      useCapture = !!(listener);
      listener = target;
      target = document;
    }
    const domListener = new DomListener(type, target, listener as ListenerFn<K>, useCapture);
    domListener.remove();
    const i = this._listenerIndex(domListener);
    if (i > -1) this._listeners.splice(i, 1);
  }
}

export class DomListener<K extends keyof EventMap>{
  type: string;
  target: EventTarget;
  listener: ListenerFn<K>;
  useCapture: boolean;

  constructor(type: string, target: EventTarget, listener: ListenerFn<K>, useCapture?: boolean) {
    this.type = type;
    this.target = target;
    this.listener = listener;
    this.useCapture = !!useCapture;
  }

  equals(domListener) {
    return this.listener === domListener.listener &&
      this.target === domListener.target &&
      this.type === domListener.type &&
      this.useCapture === domListener.useCapture;
  }

  add() {
    this.target.addEventListener(this.type, this.listener, this.useCapture);
  }
  
  remove() {
    this.target.removeEventListener(this.type, this.listener, this.useCapture);
  }
}

export class DestroyListener extends DomListener<'destroy'> {
  constructor(target: EventTarget, listener: ListenerFn<'destroy'>) {
    super('destroy', target, listener);
    DomListener.call(this, 'destroy', target, listener);
  }

  add() {
    const listeners = this.target.$destroyListeners || (this.target.$destroyListeners = []);
    if (listeners.indexOf(this.listener) === -1) {
      listeners.push(this.listener);
    }
  }

  remove() {
    const listeners = this.target.$destroyListeners;
    if (!listeners) return;
    const index = listeners.indexOf(this.listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }
}
