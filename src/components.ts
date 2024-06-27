/*
 * components.js
 *
 * Components associate custom script functionality with a view. They can be
 * distributed as standalone modules containing templates, scripts, and styles.
 * They can also be used to modularize application functionality.
 *
 */

import { type ChildModel, util } from 'racer';

import { Controller } from './Controller';
import { Page } from './Page';
import derbyTemplates = require('./templates');
import { Context } from './templates/contexts';
import { Expression } from './templates/expressions';
import { Attribute, Binding } from './templates/templates';
import { checkKeyIsSafe } from './templates/util';
const { expressions, templates } = derbyTemplates;
const slice = [].slice;

export interface DataConstructor extends Record<string, unknown> {
  new(): Record<string, unknown>
}

type AnyVoidFunction = (...args: any[]) => void;

export interface ComponentConstructor {
  new(context: Context, data: Record<string, unknown>): Component;
  DataConstructor?: DataConstructor;
  singleton?: undefined,
  view?: ComponentViewDefinition,
}

export interface SingletonComponentConstructor {
  new(): object;
  singleton: true;
  view?: ComponentViewDefinition
}

export interface ComponentViewDefinition {
  dependencies?: Array<ComponentConstructor | SingletonComponentConstructor>,
  file?: string,
  is?: string,
  source?: string,
  viewPartialDependencies?: Array<string | { is: string }>,
}

export abstract class Component<T extends object = object> extends Controller<T> {
  context: Context;
  /**
   * Unique ID assigned to the component
   */
  id: string;
  /**
   * Whether the component instance is fully destroyed. Initially set to false.
   */
  isDestroyed: boolean;
  page: Page;
  /**
   * Reference to the containing controller
   */
  parent: Controller;
  singleton?: true;
  _scope: string[];
  // new style view prop
  view?: ComponentViewDefinition;
  static DataConstructor?: DataConstructor;

  constructor(context: Context, data: Record<string, unknown>) {
    const parent = context.controller;
    const id = context.id();
    const scope = ['$components', id];
    const model = parent.model.root.eventContext(id) as ChildModel<T>;
    model._at = scope.join('.');
    data.id = id;
    model._set(scope, data);
    // Store a reference to the component's scope such that the expression
    // getters are relative to the component
    model.data = data as T;
    // IMPORTANT: call super _after_ model created
    super(context.controller.app, context.controller.page, model);

    this.parent = parent;
    this.context = context.componentChild(this);
    this.id = id;
    this._scope = scope;

    // Add reference to this component on the page so that all components
    // associated with a page can be destroyed when the page transitions
    this.page._components[id] = this;
    this.isDestroyed = false;
  }

  /**
   * Method called by Derby after instantiating a component and before rendering the template.
   *
   * This should initialize any data needed by the component, like with `this.model.start(...)`.
   *
   * `init()` could be called from the server and the browser, so do not use any DOM-only methods
   * here. Put those in `create()` instead.
   */
  init(_model: ChildModel): void {}

  /**
   * Method called by Derby once a component is loaded and ready in the DOM.
   *
   * Any model listeners (`this.model.on(...)`) and DOM listeners (`this.dom.addListener(...)`)
   * should be added here.
   *
   * This will only be called in the browser.
   */
  create?: (() => void) | (() => Promise<void>);

  destroy() {
    this.emit('destroy');
    this.model.removeContextListeners();
    this.model.destroy();
    delete this.page._components[this.id];
    if (this.page._eventModel.object) {
      const components = this.page._eventModel.object.$components;
      if (components) delete components.object[this.id];
    }
    this.isDestroyed = true;
  }

  /**
   * Generate a function, bound function to the component instance's `this`.
   * The returned function will no longer be invoked once the component is destroyed.
   *
   * @param fn - A function to be invoked with the component as its `this` value.
   * @returns a bound function, similar to JavaScript's Function.bind()
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_objects/Function/bind
   */
  bind(fn: (...args: unknown[]) => void) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let _component = this;
    let _fn = fn;
    this.on('destroy', function() {
      // Reduce potential for memory leaks by removing references to the component
      // and the passed in callback, which could have closure references
      _component = null;
      // Cease calling back after component is removed from the DOM
      _fn = null;
    });
    return function componentBindWrapper(...args) {
      if (!_fn) return;
      return _fn.apply(_component, ...args);
    };
  }

  /**
   * Generate a function that, when passing in a numeric delay, calls the function at
   * most once per that many milliseconds. Additionally, implements an interface
   * intended to be used with window.requestAnimationFrame, process.nextTick, or window.setImmediate.
   *
   * @param fn - A function to be invoked with the component instance as its `this` value.
   * @param delayArg - Amount of time (in ms) to wait until invoking `fn` again. Default '0'.
   *
   * When passing in a numeric delay, calls the function at most once per that
   * many milliseconds. Like Underscore, the function will be called on the
   * leading and the trailing edge of the delay as appropriate. Unlike Underscore,
   * calls are consistently called via setTimeout and are never synchronous. This
   * should be used for reducing the frequency of ongoing updates, such as scroll
   * events or other continuous streams of events.
   *
   * Additionally, implements an interface intended to be used with
   * window.requestAnimationFrame or process.nextTick. If one of these is passed,
   * it will be used to create a single async call following any number of
   * synchronous calls. This mode is typically used to coalesce many synchronous
   * events (such as multiple model events) into a single async event.
   * Like component.bind(), will no longer call back once the component is
-  * destroyed, which avoids possible bugs and memory leaks.
   *
   * @returns a bound function
   */
  throttle(fn: (...args: unknown[]) => void, delayArg?: number | ((fn: () => void) => void)) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let _component = this;
    this.on('destroy', function() {
      // Reduce potential for memory leaks by removing references to the component
      // and the passed in callback, which could have closure references
      _component = null;
      // Cease calling back after component is removed from the DOM
      fn = null;
    });

    // throttle(callback)
    // throttle(callback, 150)
    if (delayArg == null || typeof delayArg === 'number') {
      const delay = delayArg || 0;
      let nextArgs;
      let previous;
      const boundCallback = function() {
        const args = nextArgs;
        nextArgs = null;
        previous = +new Date();
        if (fn && args) {
          fn.apply(_component, args);
        }
      };
      return function componentThrottleWrapper(...args) {
        const queueCall = !nextArgs;
        nextArgs = slice.call(args);
        if (queueCall) {
          const now = +new Date();
          const remaining = Math.max(previous + delay - now, 0);
          setTimeout(boundCallback, remaining);
        }
      };
    }

    // throttle(callback, window.requestAnimationFrame)
    // throttle(callback, process.nextTick)
    if (typeof delayArg === 'function') {
      let nextArgs;
      const boundCallback = function() {
        const args = nextArgs;
        nextArgs = null;
        if (fn && args) {
          fn.apply(_component, args);
        }
      };
      return function componentThrottleWrapper(...args) {
        const queueCall = !nextArgs;
        nextArgs = slice.call(args);
        if (queueCall) delayArg(boundCallback);
      };
    }

    throw new Error('Second argument must be a delay function or number');
  }

  /**
   * Safe wrapper around `window.requestAnimationFrame` that ensures function not invoked
   * when component has been destroyed
   * @param fn - A function to be invoked with the component instance as its `this` value.
   */
  requestAnimationFrame(fn: () => void) {
    const safeCallback = _safeWrap(this, fn);
    window.requestAnimationFrame(safeCallback);
  }

  /**
   * Safe wrapper around `process.nextTick` that ensures function not invoked
   * when component has been destroyed
   * @param fn - A function to be invoked with the component instance as its `this` value.
   */
  nextTick(fn: () => void) {
    const safeCallback = _safeWrap(this, fn);
    process.nextTick(safeCallback);
  }

  /**
   * Suppresses calls until the function is no longer called for that many milliseconds.
   * This should be used for delaying updates triggered by user input or typing text.
   *
   * @param fn - A function to be invoked with the component instance as its `this` value.
   * @param delay - Amount of time (in ms) to wait until invoking `fn`. Default '0'.
   *
   * @returns a bound function
   */
  debounce<F extends AnyVoidFunction>(fn: (...args: Parameters<F>) => void, delay?: number): (...args: Parameters<F>) => void {
    delay = delay || 0;
    if (typeof delay !== 'number') {
      throw new Error('Second argument must be a number');
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let component = this;
    this.on('destroy', function() {
      // Reduce potential for memory leaks by removing references to the component
      // and the passed in callback, which could have closure references
      component = null;
      // Cease calling back after component is removed from the DOM
      fn = null;
    });
    let nextArgs;
    let timeout;
    const boundCallback = function() {
      const args = nextArgs;
      nextArgs = null;
      timeout = null;
      if (fn && args) {
        fn.apply(component, args);
      }
    };
    return function componentDebounceWrapper(...args: Parameters<F>) {
      nextArgs = slice.call(args);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(boundCallback, delay);
    };
  }

  /**
   * Like debounce(), suppresses calls until the function is no longer called for
   * that many milliseconds. In addition, suppresses calls while the callback
   * function is running. In other words, the callback will not be called again
   * until the supplied done() argument is called. When the debounced function is
   * called while the callback is running, the callback will be called again
   * immediately after done() is called. Thus, the callback will always receive
   * the last value passed to the debounced function.
   *
   * This avoids the potential for multiple callbacks to execute in parallel and
   * complete out of order. It also acts as an adaptive rate limiter. Use this
   * method to debounce any field that triggers an async call as the user types.
   *
   * Like component.bind(), will no longer call back once the component is
   * destroyed, which avoids possible bugs and memory leaks.
   * 
   * Forked from: https://github.com/juliangruber/async-debounce
   *
   * @param fn - A function to be invoked with the component instance as its `this` value.
   * @param delay - Amount of time (in ms) to wait until invoking `fn`. Default '0'.
   *
   * @returns a bound function
   */
  debounceAsync<F extends AnyVoidFunction>(fn: (...args: Parameters<F>) => void, delay?: number): (...args: Parameters<F>) => void {
    const applyArguments = fn.length !== 1;
    delay = delay || 0;
    if (typeof delay !== 'number') {
      throw new Error('Second argument must be a number');
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let component = this;
    this.on('destroy', function() {
      // Reduce potential for memory leaks by removing references to the component
      // and the passed in callback, which could have closure references
      component = null;
      // Cease calling back after component is removed from the DOM
      fn = null;
    });
    let running = false;
    let nextArgs;
    let timeout;
    function done() {
      const args = nextArgs;
      nextArgs = null;
      timeout = null;
      if (fn && args) {
        running = true;
        args.push(done);
        fn.apply(component, args);
      } else {
        running = false;
      }
    }
    return function componentDebounceAsyncWrapper(...args: Parameters<F>) {
      nextArgs = (applyArguments) ? slice.call(args) : [];
      if (timeout) clearTimeout(timeout);
      if (running) return;
      timeout = setTimeout(done, delay);
    };
  }

  get(viewName: string, unescaped: boolean) {
    const view = this.getView(viewName);
    return view.get(this.context, unescaped);
  }

  getFragment(viewName: string, _ns?: string) {
    const view = this.getView(viewName);
    return view.getFragment(this.context);
  }

  getView(viewName: string, _ns?: string) {
    const contextView = this.context.getView();
    return (viewName) ?
      this.app.views.find(viewName, contextView.namespace) : contextView;
  }

  /**
   * Retrieve the appropriate view attribute's value for a given view instance.
   * If the value is a template, it will be rendered prior to being returned.
   *
   * @param attrName the name of the view attribute used with a component instance
   * @returns any of the possible values that can be expressed with a view attribute
   *
   * @see https://derbyjs.github.io/derby/views/template-syntax/view-attributes
   */
  getAttribute<T>(attrName: string) {
    const attributeContext = this.context.forAttribute(attrName);
    if (!attributeContext) return;
    let value = attributeContext.attributes[attrName];
    if (value instanceof expressions.Expression) {
      value = value.get(attributeContext);
    }
    return expressions.renderValue(value, this.context) as T;
  }

  setAttribute(key: string, value: Attribute) {
    checkKeyIsSafe(key);
    this.context.parent.attributes[key] = value;
  }

  setNullAttribute(key: string, value: Attribute) {
    checkKeyIsSafe(key);
    const attributes = this.context.parent.attributes;
    if (attributes[key] == null) attributes[key] = value;
  }
}

function _safeWrap(component: Component, callback: () => void) {
  return function() {
    if (component.isDestroyed) return;
    callback.call(component);
  };
}

export class ComponentAttribute {
  expression: Expression;
  model: ChildModel;
  key: string;

  constructor(expression: Expression, model: ChildModel, key: string) {
    checkKeyIsSafe(key);
    this.expression = expression;
    this.model = model;
    this.key = key;
  }

  update(context: Context, binding: Binding) {
    const value = this.expression.get(context);
    // @ts-expect-error Unsure what type binding should be w condition
    binding.condition = value;
    this.model.setDiff(this.key, value);
  }
}

export class ComponentAttributeBinding extends Binding {
  template: any;
  context: Context;
  condition: any;

  constructor(expression: Expression, model: any, key: any, context: Context) {
    super();
    this.template = new ComponentAttribute(expression, model, key);
    this.context = context;
    this.condition = expression.get(context);
  }
}

function setModelAttributes(context: Context, model: ChildModel) {
  const attributes = context.parent.attributes;
  if (!attributes) return;
  // Set attribute values on component model
  for (const key in attributes) {
    const value = attributes[key];
    setModelAttribute(context, model, key, value);
  }
}

function setModelAttribute(context: Context, model: ChildModel, key: string, value: unknown) {
  // If an attribute is an Expression, set its current value in the model
  // and keep it up to date. When it is a resolvable path, use a Racer ref,
  // which makes it a two-way binding. Otherwise, set to the current value
  // and create a binding that will set the value in the model as the
  // expression's dependencies change.
  if (value instanceof expressions.Expression) {
    const segments = value.pathSegments(context);
    if (segments) {
      model.root.ref(model._at + '.' + key, segments.join('.'), {updateIndices: true});
    } else {
      const binding = new ComponentAttributeBinding(value, model, key, context);
      context.addBinding(binding);
      model.set(key, binding.condition);
    }
    return;
  }

  // If an attribute is a Template, set a template object in the model.
  // Eagerly rendering a template can cause excessive rendering when the
  // developer wants to pass in a complex chunk of HTML, and if we were to
  // set a string in the model that represents the template value, we'd lose
  // the ability to use the value in the component's template, since HTML
  // would be escaped and we'd lose the ability to create proper bindings.
  //
  // This may be of surprise to developers, since it may not be intuitive
  // whether a passed in value will produce an expression or a template. To
  // get the rendered value consistently, the component's getAttribute(key)
  // method may be used to get the value that would be rendered.
  if (value instanceof templates.Template) {
    const template = new templates.ContextClosure(value, context);
    model.set(key, template);
    return;
  }

  // For all other value types, set the passed in value directly. Passed in
  // values will only be set initially, so model paths should be used if
  // bindings are desired.
  model.set(key, value);
}

export function createFactory(constructor: ComponentConstructor | SingletonComponentConstructor) {
  // DEPRECATED: constructor.prototype.singleton is deprecated. "singleton"
  // static property on the constructor is preferred
  return (constructor.singleton === true) ?
    new SingletonComponentFactory(constructor) :
    new ComponentFactory(constructor);
}

function emitInitHooks(context, component) {
  if (!context.initHooks) return;
  // Run initHooks for `on` listeners immediately before init
  for (let i = 0, len = context.initHooks.length; i < len; i++) {
    context.initHooks[i].emit(context, component);
  }
}

export class ComponentModelData {
  id: string;
  $controller: Controller;
  $element: any;
  $event: any;
  [key: string]: unknown;
}

export class ComponentFactory {
  constructorFn: ComponentConstructor;

  constructor(constructorFn: ComponentConstructor) {
    this.constructorFn = constructorFn;
  }

  init(context: Context) {
    const DataConstructor = this.constructorFn.DataConstructor || ComponentModelData;
    const data = new DataConstructor();
    // eslint-disable-next-line new-cap
    const component = new this.constructorFn(context, data);
    // Detect whether the component constructor already called super by checking
    // for one of the properties it sets. If not, call the Component constructor
    if (!component.context) {
      Component.call(component, context, data);
    }
    setModelAttributes(component.context, component.model);
    // Do the user-specific initialization. The component constructor should be
    // an empty function and the actual initialization code should be done in the
    // component's init method. This means that we don't have to rely on users
    // properly calling the Component constructor method and avoids having to
    // play nice with how CoffeeScript extends class constructors
    emitInitHooks(context, component);
    component.emit('init', component);
    if (component.init) {
      if (util.isProduction) {
        component.init(component.model);
      } else {
        const initReturn: unknown = component.init(component.model);
        if (initReturn instanceof Promise) {
          console.warn(
            `Component ${component.constructor.name} init() should not be an async function:`,
            component.init
          );
        }
      }
    }

    return component.context;
  }

  create(context) {
    const component = context.controller;
    component.emit('create', component);
    // Call the component's create function after its view is rendered
    if (component.create) {
      component.create(component.model, component.dom);
    }
  }
}

function noop() {}

class SingletonComponentFactory {
  constructorFn: SingletonComponentConstructor;
  isSingleton: true;
  component: Component;

  constructor(constructorFn) {
    this.constructorFn = constructorFn;
    this.component = null;
    // Disable component from being destroyed, since it is intended to
    // be used multiple times
    constructorFn.prototype.destroy = noop;
  }

  init(context) {
    // eslint-disable-next-line new-cap
    if (!this.component) this.component = new this.constructorFn() as Component;
    return context.componentChild(this.component);
  }

  // Don't call the init or create methods for singleton components
  create() {}
}

function isBasePrototype(object) {
  return (object === Object.prototype) ||
    (object === Function.prototype) ||
    (object === null);
}

function getRootPrototype(object) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const prototype = Object.getPrototypeOf(object);
    if (isBasePrototype(prototype)) return object;
    object = prototype;
  }
}

const _extendComponent = (Object.setPrototypeOf && Object.getPrototypeOf) ?
  // Modern version, which supports ES6 classes
  function(constructor) {
    // Find the end of the prototype chain
    const rootPrototype = getRootPrototype(constructor.prototype);

    // This guard is a workaround to a bug that has occurred in Chakra when
    // app.component() is invoked twice on the same constructor. In that case,
    // the `instanceof Component` check in extendComponent incorrectly returns
    // false after the prototype has already been set to `Component.prototype`.
    // Then, this code proceeds to set the prototype of Component.prototype
    // to itself, which throws a "Cyclic __proto__ value" error.
    // https://github.com/Microsoft/ChakraCore/issues/5915
    if (rootPrototype === Component.prototype) return;

    // Establish inheritance with the pattern that Node's util.inherits() uses
    // if Object.setPrototypeOf() is available (all modern browsers & IE11).
    // This inhertance pattern is not equivalent to class extends, but it does
    // work to make instances of the constructor inherit the desired prototype
    // https://github.com/nodejs/node/issues/4179
    Object.setPrototypeOf(rootPrototype, Component.prototype);
  } :
  // Fallback for older browsers
  function(constructor) {
    // In this version, we iterate over all of the properties on the
    // constructor's prototype and merge them into a new prototype object.
    // This flattens the prototype chain, meaning that instanceof will not
    // work for classes from which the current component inherits
    const prototype = constructor.prototype;
    // Otherwise, modify constructor.prototype. This won't work with ES6
    // classes, since their prototype property is non-writeable. However, it
    // does work in older browsers that don't support Object.setPrototypeOf(),
    // and those browsers don't support ES6 classes either
    constructor.prototype = Object.create(Component.prototype);
    constructor.prototype.constructor = constructor;
    util.mergeInto(constructor.prototype, prototype);
  };

export function extendComponent(constructor: SingletonComponentConstructor | ComponentConstructor) {
  if (constructor.singleton) {
    if (constructor.prototype instanceof Component) {
      throw new Error('Singleton compoment must not extend the Component class');
    } else {
      return;
    }
  }
  // Normal components' constructors must extend Component.
  if (constructor.prototype instanceof Component) {
    return;
  }
  // For backwards compatibility, if a normal component doesn't already extend Component,
  // then append Component.prototype to the constructor's prototype chain
  _extendComponent(constructor);
}
