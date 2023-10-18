import { type Controller } from './Controller';

export type Target =
  | Element
  | Document
  | Window;

export type EventListener<T extends Event> = (event: T) => void;

export class Dom {
  controller: Controller;
  _listeners: DomListener[];

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

  // type: string, target: function, listener: boolean
  addListener<T extends Event>(type: string, listener: EventListener<T>, useCapture?: boolean): void;
  addListener<T extends Event>(type: string, target: Target, listener?: EventListener<T>, useCapture?: boolean): void;
  addListener<T extends Event>(type: string, target: Target | EventListener<T>, listener?: EventListener<T> | boolean, useCapture?: boolean): void {
    if (typeof target === 'function') {
      useCapture = !!(listener as boolean);
      listener = target as EventListener<T>;
      target = document as Target;
    }
    const domListener = (type === 'destroy')
      ? new DestroyListener(target as Target, listener as EventListener<T>)
      : new DomListener(type, target as Target, listener as EventListener<T>, useCapture);
    if (-1 === this._listenerIndex(domListener)) {
      const listeners = this._listeners || this._initListeners();
      listeners.push(domListener);
    }
    domListener.add();
  }

  on<T extends Event>(type: string, listener: EventListener<T>, useCapture?: boolean): void;
  on<T extends Event>(type: string, target: Target, listener: EventListener<T>, useCapture?: boolean): void;
  on<T extends Event>(type: string, target: Target | EventListener<T>, listener?: EventListener<T> | boolean, useCapture?: boolean): void {
    if (typeof target === 'function') {
      listener = target as EventListener<T>;
      target = document as Target;
    }
    this.addListener(type, target as Target, listener as EventListener<T>, useCapture);
  }

  once(type, target, listener, useCapture) {
    if (typeof target === 'function') {
      useCapture = listener;
      listener = target;
      target = document;
    }
    const wrappedListener = (...args) => {
      this.removeListener(type, target, wrappedListener, useCapture);
      return listener.apply(this, args);
    }
    this.addListener(type, target, wrappedListener, useCapture);
  }

  removeListener<T extends Event>(type: string, target: Target, listener: EventListener<T>, useCapture?: boolean) {
    if (typeof target === 'function') {
      useCapture = !!(listener);
      listener = target as EventListener<T>;
      target = document as Target;
    }
    const domListener = new DomListener(type, target, listener, useCapture);
    domListener.remove();
    const i = this._listenerIndex(domListener);
    if (i > -1) this._listeners.splice(i, 1);
  }
}

export class DomListener{
  type: string;
  target: Target;
  listener: EventListenerOrEventListenerObject;
  useCapture: boolean;

  constructor(type: string, target: Target, listener: EventListenerOrEventListenerObject, useCapture?: boolean) {
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

export class DestroyListener extends DomListener{
  constructor(target: Target, listener: EventListenerOrEventListenerObject) {
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
