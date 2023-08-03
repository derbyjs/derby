import { type Expression } from './expressions';
import {
  type Attributes,
  type MarkupHook,
  type View,
} from './templates';

function noop() { }

export class ContextMeta {
  addBinding: (binding: any) => void = noop;
  removeBinding: (binding: any) => void = noop;
  removeNode: (node: Node) => void = noop;
  addItemContext: (context: Context) => void = noop;
  removeItemContext: (context: Context) => void = noop;
  views = null;
  idNamespace = '';
  idCount = 0;
  pending = [];
  pauseCount = 0;
}

export class Context {
  meta: ContextMeta;
  controller: any;
  parent?: Context;
  unbound?: boolean;
  expression?: Expression;
  alias?: string;
  keyAlias?: string;
  item?: any;
  view?: View;
  attributes?: Attributes;
  hooks?: MarkupHook<any>[];
  initHooks?: MarkupHook<any>[];
  closure?: Context;
  _id?: number;
  _eventModels?: any;

  constructor(meta, controller, parent, unbound, expression?) {
    // Required properties //

    // Properties which are globally inherited for the entire page
    this.meta = meta;
    // The page or component. Must have a `model` property with a `data` property
    this.controller = controller;

    // Optional properties //

    // Containing context
    this.parent = parent;
    // Boolean set to true when bindings should be ignored
    this.unbound = unbound;
    // The expression for a block
    this.expression = expression;
    // Alias name for the given expression
    this.alias = expression && expression.meta && expression.meta.as;
    // Alias name for the index or iterated key
    this.keyAlias = expression && expression.meta && expression.meta.keyAs;

    // For Context::eachChild
    // The context of the each at render time
    this.item = null;

    // For Context::viewChild
    // Reference to the current view
    this.view = null;
    // Attribute values passed to the view instance
    this.attributes = null;
    // MarkupHooks to be called after insert into DOM of component
    this.hooks = null;
    // MarkupHooks to be called immediately before init of component
    this.initHooks = null;

    // For Context::closureChild
    // Reference to another context established at render time by ContextClosure
    this.closure = null;

    // Used in EventModel
    this._id = null;
    this._eventModels = null;
  }

  id() {
    const count = ++this.meta.idCount;
    return this.meta.idNamespace + '_' + count.toString(36);
  }

  addBinding(binding) {
    // Don't add bindings that wrap list items. Only their outer range is needed
    if (binding.itemFor) return;
    const expression = binding.template.expression;
    // Don't rerender in unbound sections
    if (expression ? expression.isUnbound(this) : this.unbound) return;
    // Don't rerender to changes in a with expression
    if (expression && expression.meta && expression.meta.blockType === 'with') return;
    this.meta.addBinding(binding);
  }

  removeBinding(binding) {
    this.meta.removeBinding(binding);
  }

  removeNode(node) {
    const bindItemStart = node.$bindItemStart;
    if (bindItemStart) {
      this.meta.removeItemContext(bindItemStart.context);
    }
    const component = node.$component;
    if (component) {
      node.$component = null;
      if (!component.singleton) {
        component.destroy();
      }
    }
    const destroyListeners = node.$destroyListeners;
    if (destroyListeners) {
      node.$destroyListeners = null;
      for (let i = 0, len = destroyListeners.length; i < len; i++) {
        destroyListeners[i]();
      }
    }
  }

  child(expression) {
    // Set or inherit the binding mode
    const blockType = expression.meta && expression.meta.blockType;
    const unbound = (blockType === 'unbound') ? true :
      (blockType === 'bound') ? false :
        this.unbound;
    return new Context(this.meta, this.controller, this, unbound, expression);
  }

  componentChild(component) {
    return new Context(this.meta, component, this, this.unbound);
  }

  // Make a context for an item in an each block
  eachChild(expression, item) {
    const context = new Context(this.meta, this.controller, this, this.unbound, expression);
    context.item = item;
    this.meta.addItemContext(context);
    return context;
  }

  viewChild(view, attributes, hooks, initHooks) {
    const context = new Context(this.meta, this.controller, this, this.unbound);
    context.view = view;
    context.attributes = attributes;
    context.hooks = hooks;
    context.initHooks = initHooks;
    return context;
  }

  closureChild(closure) {
    const context = new Context(this.meta, this.controller, this, this.unbound);
    context.closure = closure;
    return context;
  }

  forRelative(expression) {
    let context: Context = this;
    while (context && context.expression === expression || context.view) {
      context = context.parent;
    }
    return context;
  }

  // Returns the closest context which defined the named alias
  forAlias(alias) {
    let context: Context = this;
    while (context) {
      if (context.alias === alias || context.keyAlias === alias) return context;
      context = context.parent;
    }
  }

  // Returns the closest containing context for a view attribute name or nothing
  forAttribute(attribute) {
    let context: Context = this;
    while (context) {
      // Find the closest context associated with a view
      if (context.view) {
        const attributes = context.attributes;
        if (!attributes) return;
        if (Object.prototype.hasOwnProperty.call(attributes, attribute)) return context;
        // If the attribute isn't found, but the attributes inherit, continue
        // looking in the next closest view context
        if (!attributes.inherit && !attributes.extend) return;
      }
      context = context.parent;
    }
  }

  forViewParent() {
    let context: Context = this;
    while (context) {
      // When a context with a `closure` property is encountered, skip to its
      // parent context rather than returning the nearest view's. This reference
      // is created by wrapping a template in a ContextClosure template
      if (context.closure) return context.closure.parent;
      // Find the closest view and return the containing context
      if (context.view) return context.parent;
      context = context.parent;
    }
  }

  getView() {
    let context: Context = this;
    while (context) {
      // Find the closest view
      if (context.view) return context.view;
      context = context.parent;
    }
  }

  // Returns the `this` value for a context
  get() {
    const value = (this.expression) ?
      this.expression.get(this) :
      this.controller.model.data;
    if (this.item != null) {
      return value && value[this.item];
    }
    return value;
  }

  pause() {
    this.meta.pauseCount++;
  }

  unpause() {
    if (--this.meta.pauseCount) return;
    this.flush();
  }

  flush() {
    const pending = this.meta.pending;
    const len = pending.length;
    if (!len) return;
    this.meta.pending = [];
    for (let i = 0; i < len; i++) {
      pending[i]();
    }
  }

  queue(cb) {
    this.meta.pending.push(cb);
  }
}
