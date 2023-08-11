import { type Context } from './contexts';
import { concat } from './util';
import { ContextClosure, Dependency, Template } from './templates';
import * as operatorFns from './operatorFns';
import * as serializeObject from 'serialize-object';
import { DependencyOptions } from './dependencyOptions';

type SegmentOrContext = string | number | { item: number } | Context;
type Segment = string | number;
type Value = any; // global | Page | ModelData

export function lookup(segments: Segment[] | undefined, value: Value) {
  if (!segments) return value;

  for (let i = 0, len = segments.length; i < len; i++) {
    if (value == null) return value;
    value = value[segments[i]];
  }
  return value;
}

// Unlike JS, `[]` is falsey. Otherwise, truthiness is the same as JS
export function templateTruthy(value: Value[] | PrimitiveValue): boolean {
  return (Array.isArray(value)) ? value.length > 0 : !!value;
}

export function pathSegments(segments: SegmentOrContext[]): Segment[] {
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

export function renderTemplate(template: Renderable, context: Context): PrimitiveValue | Record<string, Template> {
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

type BindType = 'bound' | 'unbound'; // 'unbound' | 'bound' // parsing/index.js#799
type ValueType = 'view' | undefined;
type BlockType = string; // 'if' | 'else if' | 'else' | 'unless' | 'on' | 'end' | 'each'

export class ExpressionMeta {
  as: string;
  bindType: BindType;
  blockType: BlockType;
  isEnd: boolean;
  keyAs: string;
  module = 'expressions';
  source: string;
  type = 'ExpressionMeta';
  unescaped: boolean;
  valueType: ValueType;

  constructor(source: string, blockType?: string, isEnd?: boolean, as?: string, keyAs?: string, unescaped?: boolean, bindType?: BindType, valueType?: ValueType) {
    this.source = source;
    this.blockType = blockType;
    this.isEnd = isEnd;
    this.as = as;
    this.keyAs = keyAs;
    this.unescaped = unescaped;
    this.bindType = bindType;
    this.valueType = valueType;
  }

  serialize(): string {
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
  meta?: ExpressionMeta;
  segments: Array<string | number>;

  constructor(meta?: ExpressionMeta) {
    this.meta = meta;
  }

  serialize(): string {
    return serializeObject.instance(this, this.meta);
  }

  toString(): string {
    return this.meta && this.meta.source;
  }

  truthy(context: Context) {
    const blockType = this.meta.blockType;
    if (blockType === 'else') return true;
    const value = this.get(context, true);
    const truthy = templateTruthy(value);
    return (blockType === 'unless') ? !truthy : truthy;
  }

  get(_context: Context, _flag?: boolean): any { return undefined; }

  // Return the expression's segment list with context objects
  resolve(_context: Context): SegmentOrContext[] | undefined { return undefined; }

  // Return a list of segment lists or null
  dependencies(_context: Context, _options: DependencyOptions): Dependency[] | undefined { return undefined; }

  // Return the pathSegments that the expression currently resolves to or null
  pathSegments(context: Context): Segment[] | undefined {
    const segments = this.resolve(context);
    return segments && pathSegments(segments);
  }

  set(context: Context, value: Value): void {
    const segments = this.pathSegments(context);
    if (!segments) throw new Error('Expression does not support setting');
    context.controller.model._set(segments, value);
  }

  _resolvePatch(context: Context, segments) {
    return (context && context.expression === this && context.item != null) ?
      segments.concat(context) : segments;
  }

  isUnbound(context: Pick<Context, 'unbound'>): boolean {
    // If the template being rendered has an explicit bindType keyword, such as:
    // {{unbound #item.text}}
    const bindType = this.meta && this.meta.bindType;
    if (bindType === 'unbound') return true;
    if (bindType === 'bound') return false;
    // Otherwise, inherit from the context
    return context.unbound;
  }

  _lookupAndContextifyValue(value: Renderable, context: Context): any {
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
  value: Value;

  constructor(value: Value, meta?: ExpressionMeta) {
    super(meta);
    this.value = value;
  }

  serialize(): string {
    return serializeObject.instance(this, this.value, this.meta);
  }

  get(): any {
    return this.value;
  }
}

export class PathExpression extends Expression {
  type = 'PathExpression';
  segments: Segment[];

  constructor(segments: Segment[], meta?: ExpressionMeta) {
    super(meta);
    this.segments = segments;
  }

  serialize(): string {
    return serializeObject.instance(this, this.segments, this.meta);
  }

  get(context: Context): Record<string, any> {
    // See View::dependencies. This is needed in order to handle the case of
    // getting dependencies within a component template, in which case we cannot
    // access model data separate from rendering.
    if (!context.controller) return;
    return lookup(this.segments, context.controller.model.data);
  }

  resolve(context: Context) {
    // See View::dependencies. This is needed in order to handle the case of
    // getting dependencies within a component template, in which case we cannot
    // access model data separate from rendering.
    if (!context.controller) return;
    const segments = concat(context.controller._scope, this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context: Context, options: DependencyOptions): any {
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

  constructor(segments: Segment[], meta?: ExpressionMeta) {
    super(meta);
    this.segments = segments;
    this.meta = meta;
  }

  serialize(): string {
    return serializeObject.instance(this, this.segments, this.meta);
  }

  get(context: Context): any {
    const relativeContext = context.forRelative(this);
    const value = relativeContext.get();
    return this._lookupAndContextifyValue(value, relativeContext);
  }

  resolve(context: Context) {
    const relativeContext = context.forRelative(this);
    const base = (relativeContext.expression) ?
      relativeContext.expression.resolve(relativeContext) :
      [];
    if (!base) return;
    const segments = base.concat(this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context: Context, options: DependencyOptions): any[] {
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
  alias: string;

  constructor(alias: string, segments: Segment[], meta?: ExpressionMeta) {
    super(meta);
    this.alias = alias;
    this.segments = segments;
    this.meta = meta;
  }

  serialize(): string {
    return serializeObject.instance(this, this.alias, this.segments, this.meta);
  }

  get(context: Context) {
    const aliasContext = context.forAlias(this.alias);
    if (!aliasContext) return;
    if (aliasContext.keyAlias === this.alias) {
      return aliasContext.item;
    }
    const value = aliasContext.get();
    return this._lookupAndContextifyValue(value, aliasContext);
  }

  resolve(context: Context) {
    const aliasContext = context.forAlias(this.alias);
    if (!aliasContext) return;
    if (aliasContext.keyAlias === this.alias) return;
    const base = aliasContext.expression.resolve(aliasContext);
    if (!base) return;
    const segments = base.concat(this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context: Context, options: DependencyOptions) {
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

  constructor(attribute: any, segments: Segment[], meta?: ExpressionMeta) {
    super(meta);
    this.attribute = attribute;
    this.segments = segments;
  }

  serialize(): string {
    return serializeObject.instance(this, this.attribute, this.segments, this.meta);
  }

  get(context: Context) {
    const attributeContext = context.forAttribute(this.attribute);
    if (!attributeContext) return;
    let value = attributeContext.attributes[this.attribute];
    if (value instanceof Expression) {
      value = value.get(attributeContext);
    }
    return this._lookupAndContextifyValue(value, attributeContext);
  }

  resolve(context: Context) {
    const attributeContext = context.forAttribute(this.attribute);
    if (!attributeContext) return;
    // Attributes may be a template, an expression, or a literal value
    let base: any[];
    const value = attributeContext.attributes[this.attribute];
    if (value instanceof Expression || value instanceof Template) {
      base = value.resolve(attributeContext);
    }
    if (!base) return;
    const segments = base.concat(this.segments);
    return this._resolvePatch(context, segments);
  }

  dependencies(context: Context, options: DependencyOptions) {
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

  constructor(before: any, inside: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(meta);
    this.before = before;
    this.inside = inside;
    this.afterSegments = afterSegments;
    this.meta = meta;
  }

  serialize = function() {
    return serializeObject.instance(this, this.before, this.inside, this.afterSegments, this.meta);
  };

  get(context: Context) {
    const inside = this.inside.get(context);
    if (inside == null) return;
    const before = this.before.get(context);
    if (!before) return;
    const base = before[inside];
    return (this.afterSegments) ? lookup(this.afterSegments, base) : base;
  }

  resolve(context: Context) {
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

  dependencies(context: Context, options: any) {
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
  template: Template;
  type = 'DeferRenderExpression';

  constructor(template: Template, meta?: ExpressionMeta) {
    super(meta);
    if (!(template instanceof Template)) {
      throw new Error('DeferRenderExpression requires a Template argument');
    }
    this.template = template;
    this.meta = meta;
  }

  serialize(): string {
    return serializeObject.instance(this, this.template, this.meta);
  }

  get(context: Context) {
    return new ContextClosure(this.template, context);
  }
}

export class ArrayExpression extends Expression {
  items: any;
  afterSegments: any;
  type = 'ArrayExpression';

  constructor(items: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(meta);
    this.items = items;
    this.afterSegments = afterSegments;
    this.meta = meta;
  }

  serialize(): string {
    return serializeObject.instance(this, this.items, this.afterSegments, this.meta);
  }

  get(context: Context) {
    const items = new Array(this.items.length);
    for (let i = 0; i < this.items.length; i++) {
      const value = this.items[i].get(context);
      items[i] = value;
    }
    return (this.afterSegments) ? lookup(this.afterSegments, items) : items;
  }

  dependencies(context: Context, options: DependencyOptions) {
    if (!this.items) return;
    let dependencies: any;
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

  constructor(properties: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(meta);
    this.properties = properties;
    this.afterSegments = afterSegments;
  }

  serialize(): string {
    return serializeObject.instance(this, this.properties, this.afterSegments, this.meta);
  }

  get(context: Context) {
    const object = {};
    for (const key in this.properties) {
      const value = this.properties[key].get(context);
      object[key] = value;
    }
    return (this.afterSegments) ? lookup(this.afterSegments, object) : object;
  }

  dependencies(context: Context, options: DependencyOptions) {
    if (!this.properties) return;
    let dependencies: any;
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
  lastSegment: Segment;
  parentSegments: Segment[] | null;
  type = 'FnExpression';

  constructor(segments: Segment[], args: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(meta);
    this.segments = segments;
    this.args = args;
    this.afterSegments = afterSegments;
    this.meta = meta;
    const parentSegments = segments && segments.slice();
    this.lastSegment = parentSegments && parentSegments.pop();
    this.parentSegments = (parentSegments && parentSegments.length) ? parentSegments : null;
  }

  serialize(): string {
    return serializeObject.instance(this, this.segments, this.args, this.afterSegments, this.meta);
  }

  get(context: Context) {
    const value = this.apply(context);
    // Lookup property underneath computed value if needed
    return (this.afterSegments) ? lookup(this.afterSegments, value) : value;
  }

  apply(context: Context, extraInputs?: any[]) {
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

  _lookupParent(context: Context) {
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

  _getInputs(context: Context) {
    const inputs = [];
    for (let i = 0, len = this.args.length; i < len; i++) {
      const value = this.args[i].get(context);
      inputs.push(renderValue(value, context));
    }
    return inputs;
  }

  _applyFn(fn: { apply: (arg0: any, arg1: any[]) => any; call: (arg0: any) => any; }, context: Context, extraInputs: any[], thisArg: any) {
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

  dependencies(context: Context, options: DependencyOptions): any[] {
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

  set(context: Context, value: Value) {
    let controller = context.controller;
    let fn: { set: any; }, parent: { [x: string]: any; };
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

  constructor(segments: any, args: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(segments, args, afterSegments, meta);
  }

  _applyFn(Fn: { new(): any; bind: { apply: (arg0: any, arg1: any[]) => any; }; }, context: Context) {
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

  constructor(name: string, args: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(null, args, afterSegments, meta);
    this.name = name;
    this.getFn = operatorFns.get[name];
    this.setFn = operatorFns.set[name];
  }

  serialize(): string {
    return serializeObject.instance(this, this.name, this.args, this.afterSegments, this.meta);
  }

  apply(context: Context) {
    const inputs = this._getInputs(context);
    return this.getFn.apply(null, inputs);
  }

  set(context: Context, value: Value) {
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
  constructor(args: any, afterSegments?: any, meta?: ExpressionMeta) {
    super(',', args, afterSegments, meta);
    this.args = args;
    this.afterSegments = afterSegments;
    this.meta = meta;
  }

  serialize(): string {
    return serializeObject.instance(this, this.args, this.afterSegments, this.meta);
  }

  getFn = operatorFns.get[',']; 

  resolve(context: Context) {
    const last = this.args[this.args.length - 1];
    return last.resolve(context);
  }

  dependencies(context: Context, options: DependencyOptions) {
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
  expression: Expression;

  constructor(expression: Expression, meta?: ExpressionMeta) {
    super(meta);
    this.expression = expression;
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression, this.meta);
  }

  get(context: Context) {
    const parentContext = context.forViewParent();
    return this.expression.get(parentContext);
  }

  resolve(context: Context) {
    const parentContext = context.forViewParent();
    return this.expression.resolve(parentContext);
  }

  dependencies(context: Context, options: any) {
    const parentContext = context.forViewParent();
    return this.expression.dependencies(parentContext, options);
  }

  pathSegments(context: Context) {
    const parentContext = context.forViewParent();
    return this.expression.pathSegments(parentContext);
  }

  set(context: Context, value: Value) {
    const parentContext = context.forViewParent();
    return this.expression.set(parentContext, value);
  }
}

export class ScopedModelExpression extends Expression {
  expression: Expression;
  type = 'ScopedModelExpression';
  constructor(expression: Expression, meta?: ExpressionMeta) {
    super(meta);
    this.expression = expression;
    this.meta = meta;
  }

  serialize() {
    return serializeObject.instance(this, this.expression, this.meta);
  }

  // Return a scoped model instead of the value
  get(context: Context) {
    const segments = this.pathSegments(context);
    if (!segments) return;
    return context.controller.model.scope(segments.join('.'));
  }

  // Delegate other methods to the inner expression
  resolve(context: Context) {
    return this.expression.resolve(context);
  }

  dependencies(context: Context, options: any) {
    return this.expression.dependencies(context, options);
  }

  pathSegments(context: Context) {
    return this.expression.pathSegments(context);
  }

  set(context: Context, value: Value) {
    return this.expression.set(context, value);
  }
}

function getDependencies(value: Record<string, any>, context: Context, options: any): Dependency[] | undefined {
  if (value instanceof Expression || value instanceof Template) {
    return value.dependencies(context, options);
  }
}

function appendDependency(dependencies: any[], expression: Expression, context: Context) {
  const segments = expression.resolve(context);
  if (!segments) return dependencies;
  if (dependencies) {
    dependencies.push(segments);
    return dependencies;
  }
  return [segments];
}

function swapLastDependency(dependencies: any[], expression: Expression, context: Context) {
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
