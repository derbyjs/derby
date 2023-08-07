import { type Context } from './contexts';
import { concat } from './util';
import { ContextClosure, Template } from './templates';
import * as operatorFns from './operatorFns';
import * as serializeObject from 'serialize-object';

export function lookup(segments: string[], value) {
  if (!segments) return value;

  for (let i = 0, len = segments.length; i < len; i++) {
    if (value == null) return value;
    value = value[segments[i]];
  }
  return value;
}

// Unlike JS, `[]` is falsey. Otherwise, truthiness is the same as JS
export function templateTruthy(value) {
  return (Array.isArray(value)) ? value.length > 0 : !!value;
}

export function pathSegments(segments) {
  const result = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    result[i] = (typeof segment === 'object') ? segment.item : segment;
  }
  return result;
}

//#region Render functions

type PrimitiveValue = string | number | boolean;
type Renderable = PrimitiveValue | Template | Record<string, Template>;

export function renderValue(value: Renderable, context: Context) {
  return (typeof value !== 'object') ? value :
    (value instanceof Template) ? renderTemplate(value, context) :
      (Array.isArray(value)) ? renderArray(value, context) :
        renderObject(value, context);
}

export function renderTemplate(template: Template, context: Context) {
  let i = 1000;
  let value: Renderable = template;
  while (value instanceof Template) {
    if (--i < 0) throw new Error('Maximum template render passes exceeded');
    value = value.get(context, true);
  }
  return value;
}

export function renderArray(array: Renderable[], context: Context) {
  for (let i = 0; i < array.length; i++) {
    if (hasTemplateProperty(array[i])) {
      return renderArrayProperties(array, context);
    }
  }
  return array;
}

export function renderObject(object: Record<string, Template>, context: Context) {
  return (hasTemplateProperty(object)) ?
    renderObjectProperties(object, context) : object;
}

function hasTemplateProperty(object: Renderable): boolean {
  if (!object) return false;
  if (object.constructor !== Object) return false;
  return Object.values(object).some((value) => value instanceof Template)
}

function renderArrayProperties(array: Renderable[], context: Context) {
  const out = new Array(array.length);
  for (let i = 0; i < array.length; i++) {
    out[i] = renderValue(array[i], context);
  }
  return out;
}

function renderObjectProperties(object: Record<string, Renderable>, context: Context): Record<string, any> {
  const out = {};
  for (const key in object) {
    out[key] = renderValue(object[key], context);
  }
  return out;
}

//#endregion

export class ExpressionMeta {
  source: string;
  blockType: string;
  isEnd: boolean;
  as: string;
  keyAs: string;
  unescaped: boolean;
  bindType: string; // 'unbound' | 'bound' // parsing/index.js#799
  valueType: string;
  module = 'expressions';
  type = 'ExpressionMeta';

  constructor(source, blockType?, isEnd?, as?, keyAs?, unescaped?, bindType?, valueType?) {
    this.source = source;
    this.blockType = blockType;
    this.isEnd = isEnd;
    this.as = as;
    this.keyAs = keyAs;
    this.unescaped = unescaped;
    this.bindType = bindType;
    this.valueType = valueType;
  }

  serialize() {
    return serializeObject.instance(
      this,
      this.source,
      this.blockType,
      this.isEnd,
      this.as,
      this.keyAs,
      this.unescaped,
      this.bindType,
      this.valueType
    );
  }
}

export class Expression {
  module = 'expressions';
  type = 'Expression';
  meta: ExpressionMeta;
  segments: string[];

  constructor(meta) {
    this.meta = meta;
  }

  serialize() {
    return serializeObject.instance(this, this.meta);
  }

  toString() {
    return this.meta && this.meta.source;
  }

  truthy(context) {
    const blockType = this.meta.blockType;
    if (blockType === 'else') return true;
    const value = this.get(context, true);
    const truthy = templateTruthy(value);
    return (blockType === 'unless') ? !truthy : truthy;
  }

  get(_context, _flag?): any { }

  // Return the expression's segment list with context objects
  resolve(_context): any { }

  // Return a list of segment lists or null
  dependencies(_context, _options): any { }

  // Return the pathSegments that the expression currently resolves to or null
  pathSegments(context) {
    const segments = this.resolve(context);
    return segments && pathSegments(segments);
  }

  set(context, value) {
    const segments = this.pathSegments(context);
    if (!segments) throw new Error('Expression does not support setting');
    context.controller.model._set(segments, value);
  }

  _resolvePatch(context, segments) {
    return (context && context.expression === this && context.item != null) ?
      segments.concat(context) : segments;
  }

  isUnbound(context) {
    // If the template being rendered has an explicit bindType keyword, such as:
    // {{unbound #item.text}}
    const bindType = this.meta && this.meta.bindType;
    if (bindType === 'unbound') return true;
    if (bindType === 'bound') return false;
    // Otherwise, inherit from the context
    return context.unbound;
  }

  _lookupAndContextifyValue(value, context) {
    if (this.segments && this.segments.length) {
      // If expression has segments, e.g. `bar.baz` in `#foo.bar.baz`, then
      // render the base value (e.g. `#foo`) if it's a template and look up the
      // value at the indicated path.
      value = renderTemplate(value, context);
      value = lookup(this.segments, value);
    }
    if (value instanceof Template && !(value instanceof ContextClosure)) {
      // If we're not immediately rendering the template, then create a ContextClosure
      // so that the value renders with the correct context later.
      value = new ContextClosure(value, context);
    }
    return value;
  }
}

export class LiteralExpression extends Expression {
  type = 'LiteralExpression';
  value: any;

  constructor(value, meta) {
    super(meta);
    this.value = value;
  }

  serialize() {
    return serializeObject.instance(this, this.value, this.meta);
  }

  get() {
    return this.value;
  }
}

export class PathExpression extends Expression {
  type = 'PathExpression';
  segments: string[];

  constructor(segments, meta) {
    super(meta);
    this.segments = segments;
  }

  serialize() {
    return serializeObject.instance(this, this.segments, this.meta);
  }

  get(context) {
    // See View::dependencies. This is needed in order to handle the case of
    // getting dependencies within a component template, in which case we cannot
    // access model data separate from rendering.
    if (!context.controller) return;
    return lookup(this.segments, context.controller.model.data);
  }

  resolve(context) {
    // See View::dependencies. This is needed in order to handle the case of
    // getting dependencies within a component template, in which case we cannot
    // access model data separate from rendering.
    if (!context.controller) return;
    const segments = concat(context.controller._scope, this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context, options) {
    // See View::dependencies. This is needed in order to handle the case of
    // getting dependencies within a component template, in which case we cannot
    // access model data separate from rendering.
    if (!context.controller) return;
    const value = lookup(this.segments, context.controller.model.data);
    const dependencies = getDependencies(value, context, options);
    return appendDependency(dependencies, this, context);
  }
}

export class RelativePathExpression extends Expression {
  type = 'RelativePathExpression';

  constructor(segments, meta) {
    super(meta);
    this.segments = segments;
    this.meta = meta;
  }

  serialize() {
    return serializeObject.instance(this, this.segments, this.meta);
  }

  get(context) {
    const relativeContext = context.forRelative(this);
    const value = relativeContext.get();
    return this._lookupAndContextifyValue(value, relativeContext);
  }

  resolve(context) {
    const relativeContext = context.forRelative(this);
    const base = (relativeContext.expression) ?
      relativeContext.expression.resolve(relativeContext) :
      [];
    if (!base) return;
    const segments = base.concat(this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context, options) {
    // Return inner dependencies from our ancestor
    // (e.g., {{ with foo[bar] }} ... {{ this.x }} has 'bar' as a dependency.)
    const relativeContext = context.forRelative(this);
    const dependencies = relativeContext.expression &&
      relativeContext.expression.dependencies(relativeContext, options);
    return swapLastDependency(dependencies, this, context);
  }
}

export class AliasPathExpression extends Expression {
  type = 'AliasPathExpression';
  alias: any;

  constructor(alias, segments, meta) {
    super(meta);
    this.alias = alias;
    this.segments = segments;
    this.meta = meta;
  }

  serialize() {
    return serializeObject.instance(this, this.alias, this.segments, this.meta);
  }

  get(context) {
    const aliasContext = context.forAlias(this.alias);
    if (!aliasContext) return;
    if (aliasContext.keyAlias === this.alias) {
      return aliasContext.item;
    }
    const value = aliasContext.get();
    return this._lookupAndContextifyValue(value, aliasContext);
  }

  resolve(context) {
    const aliasContext = context.forAlias(this.alias);
    if (!aliasContext) return;
    if (aliasContext.keyAlias === this.alias) return;
    const base = aliasContext.expression.resolve(aliasContext);
    if (!base) return;
    const segments = base.concat(this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context, options) {
    const aliasContext = context.forAlias(this.alias);
    if (!aliasContext) return;
    if (aliasContext.keyAlias === this.alias) {
      // For keyAliases, use a dependency of the entire list, so that it will
      // always update when the list itself changes. This is over-binding, but
      // would otherwise be much more complex
      const base = aliasContext.expression.resolve(aliasContext.parent);
      if (!base) return;
      return [base];
    }

    const dependencies = aliasContext.expression.dependencies(aliasContext, options);
    return swapLastDependency(dependencies, this, context);
  }
}

export class AttributePathExpression extends Expression {
  type = 'AttributePathExpression';
  attribute: any;
  constructor(attribute, segments, meta) {
    super(meta);
    this.attribute = attribute;
    this.segments = segments;
  }

  serialize() {
    return serializeObject.instance(this, this.attribute, this.segments, this.meta);
  }

  get(context) {
    const attributeContext = context.forAttribute(this.attribute);
    if (!attributeContext) return;
    let value = attributeContext.attributes[this.attribute];
    if (value instanceof Expression) {
      value = value.get(attributeContext);
    }
    return this._lookupAndContextifyValue(value, attributeContext);
  }

  resolve(context) {
    const attributeContext = context.forAttribute(this.attribute);
    if (!attributeContext) return;
    // Attributes may be a template, an expression, or a literal value
    let base;
    const value = attributeContext.attributes[this.attribute];
    if (value instanceof Expression || value instanceof Template) {
      base = value.resolve(attributeContext);
    }
    if (!base) return;
    const segments = base.concat(this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context, options) {
    const attributeContext = context.forAttribute(this.attribute);
    if (!attributeContext) return;

    // Attributes may be a template, an expression, or a literal value
    const value = attributeContext.attributes[this.attribute];
    const dependencies = getDependencies(value, attributeContext, options);
    return swapLastDependency(dependencies, this, context);
  }
}

export class BracketsExpression extends Expression {
  type = 'BracketsExpression';
  before: any;
  inside: any;
  afterSegments: any;

  constructor(before, inside, afterSegments, meta) {
    super(meta);
    this.before = before;
    this.inside = inside;
    this.afterSegments = afterSegments;
    this.meta = meta;
  }

  serialize = function() {
    return serializeObject.instance(this, this.before, this.inside, this.afterSegments, this.meta);
  };

  get(context) {
    const inside = this.inside.get(context);
    if (inside == null) return;
    const before = this.before.get(context);
    if (!before) return;
    const base = before[inside];
    return (this.afterSegments) ? lookup(this.afterSegments, base) : base;
  }

  resolve(context) {
    // Get and split the current value of the expression inside the brackets
    const inside = this.inside.get(context);
    if (inside == null) return;

    // Concat the before, inside, and optional after segments
    const base = this.before.resolve(context);
    if (!base) return;
    const segments = (this.afterSegments) ?
      base.concat(inside, this.afterSegments) :
      base.concat(inside);
    return this._resolvePatch(context, segments);
  }

  dependencies(context, options) {
    const before = this.before.dependencies(context, options);
    if (before) before.pop();
    const inner = this.inside.dependencies(context, options);
    const dependencies = concat(before, inner);
    return appendDependency(dependencies, this, context);
  }
}

// This Expression is used to wrap a template so that when its containing
// Expression--such as an ObjectExpression or ArrayExpression--is evaluated,
// it returns the template unrendered and wrapped in the current context.
// Separating evaluation of the containing expression from template rendering
// is used to support array attributes of views. This way, we can evaluate an
// array and iterate through it separately from rendering template content
export class DeferRenderExpression extends Expression {
  template: any;
  type = 'DeferRenderExpression';

  constructor(template, meta) {
    super(meta);
    if (!(template instanceof Template)) {
      throw new Error('DeferRenderExpression requires a Template argument');
    }
    this.template = template;
    this.meta = meta;
  }

  serialize() {
    return serializeObject.instance(this, this.template, this.meta);
  }

  get(context) {
    return new ContextClosure(this.template, context);
  }
}

export class ArrayExpression extends Expression {
  items: any;
  afterSegments: any;
  type = 'ArrayExpression';

  constructor(items, afterSegments, meta) {
    super(meta);
    this.items = items;
    this.afterSegments = afterSegments;
    this.meta = meta;
  }

  serialize() {
    return serializeObject.instance(this, this.items, this.afterSegments, this.meta);
  }

  get(context) {
    const items = new Array(this.items.length);
    for (let i = 0; i < this.items.length; i++) {
      const value = this.items[i].get(context);
      items[i] = value;
    }
    return (this.afterSegments) ? lookup(this.afterSegments, items) : items;
  }

  dependencies(context, options) {
    if (!this.items) return;
    let dependencies;
    for (let i = 0; i < this.items.length; i++) {
      const itemDependencies = this.items[i].dependencies(context, options);
      dependencies = concat(dependencies, itemDependencies);
    }
    return dependencies;
  }
}

export class ObjectExpression extends Expression {
  properties: any;
  afterSegments: any;
  type = 'ObjectExpression';

  constructor(properties, afterSegments, meta) {
    super(meta);
    this.properties = properties;
    this.afterSegments = afterSegments;
  }

  serialize() {
    return serializeObject.instance(this, this.properties, this.afterSegments, this.meta);
  }

  get(context) {
    const object = {};
    for (const key in this.properties) {
      const value = this.properties[key].get(context);
      object[key] = value;
    }
    return (this.afterSegments) ? lookup(this.afterSegments, object) : object;
  }

  dependencies(context, options) {
    if (!this.properties) return;
    let dependencies;
    for (const key in this.properties) {
      const propertyDependencies = this.properties[key].dependencies(context, options);
      dependencies = concat(dependencies, propertyDependencies);
    }
    return dependencies;
  }
}

export class FnExpression extends Expression {
  args: any;
  afterSegments: any;
  lastSegment: any;
  parentSegments: any;
  type = 'FnExpression';

  constructor(segments, args, afterSegments, meta) {
    super(meta);
    this.segments = segments;
    this.args = args;
    this.afterSegments = afterSegments;
    this.meta = meta;
    const parentSegments = segments && segments.slice();
    this.lastSegment = parentSegments && parentSegments.pop();
    this.parentSegments = (parentSegments && parentSegments.length) ? parentSegments : null;
  }

  serialize() {
    return serializeObject.instance(this, this.segments, this.args, this.afterSegments, this.meta);
  }

  get(context) {
    const value = this.apply(context);
    // Lookup property underneath computed value if needed
    return (this.afterSegments) ? lookup(this.afterSegments, value) : value;
  }

  apply(context, extraInputs?) {
    // See View::dependencies. This is needed in order to handle the case of
    // getting dependencies within a component template, in which case we cannot
    // access model data separate from rendering.
    if (!context.controller) return;
    const parent = this._lookupParent(context);
    const fn = parent[this.lastSegment];
    const getFn = fn.get || fn;
    const out = this._applyFn(getFn, context, extraInputs, parent);
    return out;
  }

  _lookupParent(context) {
    // Lookup function on current controller
    const controller = context.controller;
    const segments = this.parentSegments;
    let parent = (segments) ? lookup(segments, controller) : controller;
    if (parent && parent[this.lastSegment]) return parent;
    // Otherwise lookup function on page
    const page = controller.page;
    if (controller !== page) {
      parent = (segments) ? lookup(segments, page) : page;
      if (parent && parent[this.lastSegment]) return parent;
    }
    // Otherwise lookup function on global
    parent = (segments) ? lookup(segments, global) : global;
    if (parent && parent[this.lastSegment]) return parent;
    // Throw if not found
    throw new Error('Function not found for: ' + this.segments.join('.'));
  }

  _getInputs(context) {
    const inputs = [];
    for (let i = 0, len = this.args.length; i < len; i++) {
      const value = this.args[i].get(context);
      inputs.push(renderValue(value, context));
    }
    return inputs;
  }

  _applyFn(fn, context, extraInputs, thisArg) {
    // Apply if there are no path inputs
    if (!this.args) {
      return (extraInputs) ?
        fn.apply(thisArg, extraInputs) :
        fn.call(thisArg);
    }
    // Otherwise, get the current value for path inputs and apply
    const inputs = this._getInputs(context);
    if (extraInputs) {
      for (let i = 0, len = extraInputs.length; i < len; i++) {
        inputs.push(extraInputs[i]);
      }
    }
    return fn.apply(thisArg, inputs);
  }

  dependencies(context, options) {
    const dependencies = [];
    if (!this.args) return dependencies;
    for (let i = 0, len = this.args.length; i < len; i++) {
      const argDependencies = this.args[i].dependencies(context, options);
      if (!argDependencies || argDependencies.length < 1) continue;
      const end = argDependencies.length - 1;
      for (let j = 0; j < end; j++) {
        dependencies.push(argDependencies[j]);
      }
      let last = argDependencies[end];
      if (last[last.length - 1] !== '*') {
        last = last.concat('*');
      }
      dependencies.push(last);
    }
    return dependencies;
  }

  set(context, value) {
    let controller = context.controller;
    let fn, parent;
    while (controller) {
      parent = (this.parentSegments) ?
        lookup(this.parentSegments, controller) :
        controller;
      fn = parent && parent[this.lastSegment];
      if (fn) break;
      controller = controller.parent;
    }
    const setFn = fn && fn.set;
    if (!setFn) throw new Error('No setter function for: ' + this.segments.join('.'));
    const inputs = this._getInputs(context);
    inputs.unshift(value);
    const out = setFn.apply(parent, inputs);
    for (const i in out) {
      this.args[i].set(context, out[i]);
    }
  }
}

export class NewExpression extends FnExpression {
  type = 'NewExpression';

  constructor(segments, args, afterSegments, meta) {
    super(segments, args, afterSegments, meta);
  }

  _applyFn(Fn, context) {
    // Apply if there are no path inputs
    if (!this.args) return new Fn();
    // Otherwise, get the current value for path inputs and apply
    const inputs = this._getInputs(context);
    inputs.unshift(null);
    return new (Fn.bind.apply(Fn, inputs))();
  }
}

export class OperatorExpression extends FnExpression {
  type = 'OperatorExpression';
  name: string;
  getFn: any;
  setFn: any;

  constructor(name, args, afterSegments, meta) {
    super(null, args, afterSegments, meta);
    this.name = name;
    this.getFn = operatorFns.get[name];
    this.setFn = operatorFns.set[name];
  }

  serialize() {
    return serializeObject.instance(this, this.name, this.args, this.afterSegments, this.meta);
  }

  apply(context) {
    const inputs = this._getInputs(context);
    return this.getFn.apply(null, inputs);
  }

  set(context, value) {
    const inputs = this._getInputs(context);
    inputs.unshift(value);
    const out = this.setFn.apply(null, inputs);
    for (const i in out) {
      this.args[i].set(context, out[i]);
    }
  }
}

export class SequenceExpression extends OperatorExpression {
  type = 'SequenceExpression';
  constructor(args, afterSegments, meta) {
    super(',', args, afterSegments, meta);
    this.args = args;
    this.afterSegments = afterSegments;
    this.meta = meta;
  }
  serialize() {
    return serializeObject.instance(this, this.args, this.afterSegments, this.meta);
  }
  getFn = operatorFns.get[','];
  resolve(context) {
    const last = this.args[this.args.length - 1];
    return last.resolve(context);
  }
  dependencies(context, options) {
    const dependencies = [];
    for (let i = 0, len = this.args.length; i < len; i++) {
      const argDependencies = this.args[i].dependencies(context, options);
      for (let j = 0, jLen = argDependencies.length; j < jLen; j++) {
        dependencies.push(argDependencies[j]);
      }
    }
    return dependencies;
  }
}
// For each method that takes a context argument, get the nearest parent view
// context, then delegate methods to the inner expression
export class ViewParentExpression extends Expression {
  type = 'ViewParentExpression';
  expression: any;

  constructor(expression, meta) {
    super(meta);
    this.expression = expression;
  }

  serialize() {
    return serializeObject.instance(this, this.expression, this.meta);
  }

  get(context) {
    const parentContext = context.forViewParent();
    return this.expression.get(parentContext);
  }

  resolve(context) {
    const parentContext = context.forViewParent();
    return this.expression.resolve(parentContext);
  }

  dependencies(context, options) {
    const parentContext = context.forViewParent();
    return this.expression.dependencies(parentContext, options);
  }

  pathSegments(context) {
    const parentContext = context.forViewParent();
    return this.expression.pathSegments(parentContext);
  }

  set(context, value) {
    const parentContext = context.forViewParent();
    return this.expression.set(parentContext, value);
  }
}

export class ScopedModelExpression extends Expression {
  expression: any;
  type = 'ScopedModelExpression';
  constructor(expression, meta) {
    super(meta);
    this.expression = expression;
    this.meta = meta;
  }

  serialize = function() {
    return serializeObject.instance(this, this.expression, this.meta);
  };

  // Return a scoped model instead of the value
  get = function(context) {
    const segments = this.pathSegments(context);
    if (!segments) return;
    return context.controller.model.scope(segments.join('.'));
  };

  // Delegate other methods to the inner expression
  resolve = function(context) {
    return this.expression.resolve(context);
  };

  dependencies = function(context, options) {
    return this.expression.dependencies(context, options);
  };

  pathSegments = function(context) {
    return this.expression.pathSegments(context);
  };

  set = function(context, value) {
    return this.expression.set(context, value);
  };
}

function getDependencies(value, context, options) {
  if (value instanceof Expression || value instanceof Template) {
    return value.dependencies(context, options);
  }
}

function appendDependency(dependencies, expression, context) {
  const segments = expression.resolve(context);
  if (!segments) return dependencies;
  if (dependencies) {
    dependencies.push(segments);
    return dependencies;
  }
  return [segments];
}

function swapLastDependency(dependencies, expression, context) {
  if (!expression.segments.length) {
    return dependencies;
  }
  const segments = expression.resolve(context);
  if (!segments) return dependencies;
  if (dependencies) {
    dependencies.pop();
    dependencies.push(segments);
    return dependencies;
  }
  return [segments];
}
