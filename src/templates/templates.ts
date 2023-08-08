if (typeof require === 'function') {
  var serializeObject = require('serialize-object');
}

import { type Context } from './contexts';
import { DependencyOptions } from './dependencyOptions';
import { type Expression } from './expressions';
import { concat, hasKeys, traverseAndCreate } from './util';

export type Attributes = Record<string, Attribute>;

// UPDATE_PROPERTIES map HTML attribute names to an Element DOM property that
// should be used for setting on bindings updates instead of setAttribute.
//
// https://github.com/jquery/jquery/blob/1.x-master/src/attributes/prop.js
// https://github.com/jquery/jquery/blob/master/src/attributes/prop.js
// http://webbugtrack.blogspot.com/2007/08/bug-242-setattribute-doesnt-always-work.html
export const BOOLEAN_PROPERTIES = {
  checked: 'checked',
  disabled: 'disabled',
  indeterminate: 'indeterminate',
  readonly: 'readOnly',
  selected: 'selected'
};

export const INTEGER_PROPERTIES = {
  colspan: 'colSpan',
  maxlength: 'maxLength',
  rowspan: 'rowSpan',
  tabindex: 'tabIndex'
};

export const STRING_PROPERTIES = {
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  'class': 'className',
  contenteditable: 'contentEditable',
  enctype: 'encoding',
  'for': 'htmlFor',
  frameborder: 'frameBorder',
  id: 'id',
  title: 'title',
  type: 'type',
  usemap: 'useMap',
  value: 'value'
};

export const UPDATE_PROPERTIES = {
  ...BOOLEAN_PROPERTIES,
  ...INTEGER_PROPERTIES,
  ...STRING_PROPERTIES,
};

// CREATE_PROPERTIES map HTML attribute names to an Element DOM property that
// should be used for setting on Element rendering instead of setAttribute.
// input.defaultChecked and input.defaultValue affect the attribute, so we want
// to use these for initial dynamic rendering. For binding updates,
// input.checked and input.value are modified.
export const CREATE_PROPERTIES = {
  ...UPDATE_PROPERTIES,
  checked: 'defaultChecked',
  value: 'defaultValue',
};

// http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
export const VOID_ELEMENTS = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  keygen: true,
  link: true,
  menuitem: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true
};

export const NAMESPACE_URIS = {
  svg: 'http://www.w3.org/2000/svg',
  xlink: 'http://www.w3.org/1999/xlink',
  xmlns: 'http://www.w3.org/2000/xmlns/'
};

export class Template {
  module = 'templates';
  type = 'Template';
  content: Template[];
  source: string;
  expression?: Expression;
  unbound?: boolean;
  hooks: MarkupHook<any>[];

  constructor(content?, source?) {
    this.content = content;
    this.source = source;
  }

  toString() {
    return this.source;
  }

  get(context: Context, unescaped: boolean): any {
    return contentHtml(this.content, context, unescaped);
  }

  getFragment(context: Context, binding?) {
    const fragment = document.createDocumentFragment();
    this.appendTo(fragment, context, binding);
    return fragment;
  }

  appendTo(parent: Node, context: Context, _binding?) {
    context.pause();
    appendContent(parent, this.content, context);
    context.unpause();
  }

  attachTo(parent: Node, node, context: Context) {
    context.pause();
    var node = attachContent(parent, node, this.content, context);
    context.unpause();
    return node;
  }

  update(_context: Context, _binding) { }

  stringify(value) {
    return (value == null) ? '' : value + '';
  }

  equals(other) {
    return this === other;
  }

  serialize(): string {
    return serializeObject.instance(this, this.content, this.source);
  }

  isUnbound(context: Context): boolean {
    return context.unbound;
  }

  resolve(_context: Context): any { }

  dependencies(context: Context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    return concatArrayDependencies(null, this.content, context, options);
  }
}

export class Doctype extends Template {
  type = 'Doctype';
  name: string;
  publicId: string;
  systemId: string;

  constructor(name, publicId, systemId) {
    super();
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
  }

  get() {
    const publicText = (this.publicId) ?
      ' PUBLIC "' + this.publicId + '"' :
      '';
    const systemText = (this.systemId) ?
      (this.publicId) ?
        ' "' + this.systemId + '"' :
        ' SYSTEM "' + this.systemId + '"' :
      '';
    return '<!DOCTYPE ' + this.name + publicText + systemText + '>';
  }

  appendTo() {
    // Doctype could be created via:
    //   document.implementation.createDocumentType(this.name, this.publicId, this.systemId)
    // However, it does not appear possible or useful to append it to the
    // document fragment. Therefore, just don't render it in the browser
  }

  attachTo(parent: Node, node: Node) {
    if (!node || node.nodeType !== 10) {
      throw attachError(parent, node);
    }
    return node.nextSibling;
  }

  serialize(): string {
    return serializeObject.instance(this, this.name, this.publicId, this.systemId);
  }

  dependencies() { }
}

export class Text extends Template {
  type = 'Text';
  data: string;
  escaped: string;

  constructor(data) {
    super();
    this.data = data;
    this.escaped = escapeHtml(data);
  }

  get(context, unescaped) {
    return (unescaped) ? this.data : this.escaped;
  }

  appendTo(parent: Node) {
    const node = document.createTextNode(this.data);
    parent.appendChild(node);
  }

  attachTo(parent: Node, node: Node) {
    return attachText(parent, node, this.data, this);
  }

  serialize(): string {
    return serializeObject.instance(this, this.data);
  }

  dependencies() { }
}

// DynamicText might be more accurately named DynamicContent. When its
// expression returns a template, it acts similar to a Block, and it renders
// the template surrounded by comment markers for range replacement. When its
// expression returns any other type, it renders a DOM Text node with no
// markers. Text nodes are bound by updating their data property dynamically.
// The update method must take care to switch between these types of bindings
// in case the expression return type changes dynamically.
export class DynamicText extends Template {
  expression: Expression;
  unbound: boolean;

  constructor(expression) {
    super();
    this.expression = expression;
    this.unbound = false;
  }

  get(context, unescaped) {
    let value = this.expression.get(context);
    if (value instanceof Template) {
      do {
        value = value.get(context, unescaped);
      } while (value instanceof Template);
      return value;
    }
    const data = this.stringify(value);
    return (unescaped) ? data : escapeHtml(data);
  }

  appendTo(parent: Node, context, binding) {
    const value = this.expression.get(context);
    if (value instanceof Template) {
      const start = document.createComment(this.expression.toString());
      const end = document.createComment('/' + this.expression);
      const condition = this.getCondition(context);
      parent.appendChild(start);
      value.appendTo(parent, context);
      parent.appendChild(end);
      updateRange(context, binding, this, start, end, null, condition);
      return;
    }
    const data = this.stringify(value);
    const node = document.createTextNode(data);
    parent.appendChild(node);
    addNodeBinding(this, context, node);
  }

  attachTo(parent: Node, node, context) {
    const value = this.expression.get(context);
    if (value instanceof Template) {
      const start = document.createComment(this.expression.toString());
      const end = document.createComment('/' + this.expression);
      const condition = this.getCondition(context);
      parent.insertBefore(start, node || null);
      node = value.attachTo(parent, node, context);
      parent.insertBefore(end, node || null);
      updateRange(context, null, this, start, end, null, condition);
      return node;
    }
    const data = this.stringify(value);
    return attachText(parent, node, data, this, context);
  }
  type = 'DynamicText';

  update(context, binding) {
    if (binding instanceof RangeBinding) {
      this._blockUpdate(context, binding);
      return;
    }
    const value = this.expression.get(context);
    if (value instanceof Template) {
      const start = binding.node;
      if (!start.parentNode) return;
      const end = start;
      const fragment = this.getFragment(context);
      replaceRange(context, start, end, fragment, binding);
      return;
    }
    binding.node.data = this.stringify(value);
  }

  getCondition(context) {
    return this.expression.get(context);
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression);
  }

  _blockUpdate = Block.prototype.update;

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    return getDependencies(this.expression, context, options);
  }
}

function attachText(parent: Node, node: Node, data: string, template: Template, context?: Context) {
  if (!node) {
    const newNode = document.createTextNode(data);
    parent.appendChild(newNode);
    addNodeBinding(template, context, newNode);
    return;
  }
  if (node.nodeType === 3) {
    // Proceed if nodes already match
    // @ts-expect-error Known Text node at this point
    if (node.data === data) {
      addNodeBinding(template, context, node);
      return node.nextSibling;
    }
    data = normalizeLineBreaks(data);
    // Split adjacent text nodes that would have been merged together in HTML
    const nextNode = splitData(node, data.length);
    // @ts-expect-error Known Text node at this point
    if (node.data !== data) {
      throw attachError(parent, node);
    }
    addNodeBinding(template, context, node);
    return nextNode;
  }
  // An empty text node might not be created at the end of some text
  if (data === '') {
    const newNode = document.createTextNode('');
    parent.insertBefore(newNode, node || null);
    addNodeBinding(template, context, newNode);
    return node;
  }
  throw attachError(parent, node);
}

export class Comment extends Template {
  data: string;
  hooks: MarkupHook<any>[];
  type = 'Comment';

  constructor(data, hooks) {
    super();
    this.data = data;
    this.hooks = hooks;
  }

  get() {
    return '<!--' + this.data + '-->';
  }

  appendTo(parent: Node, context) {
    const node = document.createComment(this.data);
    parent.appendChild(node);
    emitHooks(this.hooks, context, node);
  }

  attachTo(parent: Node, node, context) {
    return attachComment(parent, node, this.data, this, context);
  }

  serialize(): string {
    return serializeObject.instance(this, this.data, this.hooks);
  }

  dependencies() { }
}

export class DynamicComment extends Template {
  expression: Expression;
  hooks: MarkupHook<any>[];
  type = 'DynamicComment';

  constructor(expression, hooks) {
    super();
    this.expression = expression;
    this.hooks = hooks;
  }

  get(context) {
    const value = getUnescapedValue(this.expression, context);
    const data = this.stringify(value);
    return '<!--' + data + '-->';
  }

  appendTo(parent: Node, context) {
    const value = getUnescapedValue(this.expression, context);
    const data = this.stringify(value);
    const node = document.createComment(data);
    parent.appendChild(node);
    addNodeBinding(this, context, node);
  }

  attachTo(parent: Node, node, context) {
    const value = getUnescapedValue(this.expression, context);
    const data = this.stringify(value);
    return attachComment(parent, node, data, this, context);
  }

  update(context, binding) {
    const value = getUnescapedValue(this.expression, context);
    binding.node.data = this.stringify(value);
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression, this.hooks);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    return getDependencies(this.expression, context, options);
  }
}

function attachComment(parent: Node, node: Node, data: string, template: Template, context: Context) {
  // Sometimes IE fails to create Comment nodes from HTML or innerHTML.
  // This is an issue inside of <select> elements, for example.
  if (!node || node.nodeType !== 8) {
    const newNode = document.createComment(data);
    parent.insertBefore(newNode, node || null);
    addNodeBinding(template, context, newNode);
    return node;
  }
  // Proceed if nodes already match
  // @ts-expect-error Dom Comment Node
  if (node.data === data) {
    addNodeBinding(template, context, node);
    return node.nextSibling;
  }
  throw attachError(parent, node);
}

function addNodeBinding(template: Template, context: Context, node: Node) {
  if (template.expression && !template.unbound) {
    context.addBinding(new NodeBinding(template, context, node));
  }
  emitHooks(template.hooks, context, node);
}

export class Html extends Template {
  data: string;
  type = 'Html';

  constructor(data: string) {
    super();
    this.data = data;
  }

  get() {
    return this.data;
  }

  appendTo(parent: Node) {
    const fragment = createHtmlFragment(parent, this.data);
    parent.appendChild(fragment);
  }

  attachTo(parent: Node, node: Node) {
    return attachHtml(parent, node, this.data);
  }

  serialize(): string {
    return serializeObject.instance(this, this.data);
  }

  dependencies() { }
}

export class DynamicHtml extends Template {
  ending: any;
  type = 'DynamicHtml';

  constructor(expression) {
    super();
    this.expression = expression;
    this.ending = '/' + expression;
  }

  get(context) {
    const value = getUnescapedValue(this.expression, context);
    return this.stringify(value);
  }

  appendTo(parent: Node, context, binding) {
    const start = document.createComment(this.expression.toString());
    const end = document.createComment(this.ending);
    const value = getUnescapedValue(this.expression, context);
    const html = this.stringify(value);
    const fragment = createHtmlFragment(parent, html);
    parent.appendChild(start);
    parent.appendChild(fragment);
    parent.appendChild(end);
    updateRange(context, binding, this, start, end);
  }

  attachTo(parent: Node, node, context) {
    const start = document.createComment(this.expression.toString());
    const end = document.createComment(this.ending);
    const value = getUnescapedValue(this.expression, context);
    const html = this.stringify(value);
    parent.insertBefore(start, node || null);
    node = attachHtml(parent, node, html);
    parent.insertBefore(end, node || null);
    updateRange(context, null, this, start, end);
    return node;
  }

  update(context, binding) {
    const parent = binding.start.parentNode;
    if (!parent) return;
    // Get start and end in advance, since binding is mutated in getFragment
    const start = binding.start;
    const end = binding.end;
    const value = getUnescapedValue(this.expression, context);
    const html = this.stringify(value);
    const fragment = createHtmlFragment(parent, html);
    const innerOnly = true;
    replaceRange(context, start, end, fragment, binding, innerOnly);
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    return getDependencies(this.expression, context, options);
  }
}

function createHtmlFragment(parent: Node, html: string) {
  if (parent && parent.nodeType === 1) {
    var range = document.createRange();
    range.selectNodeContents(parent);
    return range.createContextualFragment(html);
  }
  const div = document.createElement('div');
  var range = document.createRange();
  div.innerHTML = html;
  range.selectNodeContents(div);
  return range.extractContents();
}

function attachHtml(parent: Node, node: Node, html: string) {
  const fragment = createHtmlFragment(parent, html);
  for (let i = 0, len = fragment.childNodes.length; i < len; i++) {
    if (!node) throw attachError(parent, node);
    node = node.nextSibling;
  }
  return node;
}

export class Attribute extends Template {
  data?: string | boolean;
  ns?: string;
  type = 'Attribute';

  constructor(data?, ns?) {
    super();
    this.data = data;
    this.ns = ns;
  }

  get(_context?: Context): any {
    return this.data;
  }

  getBound(_context, _element, _name, _elementNs) {
    return this.get();
  }

  serialize(): string {
    return serializeObject.instance(this, this.data, this.ns);
  }

  dependencies(_context, _options) { }
}

export class DynamicAttribute extends Attribute {
  expression: Expression;
  elementNs: string;
  type = 'DynamicAttribute';

  constructor(expression, ns?) {
    super(null, ns);
    // In attributes, expression may be an instance of Template or Expression
    this.expression = expression;
    this.elementNs = null;
  }

  get(context) {
    return getUnescapedValue(this.expression, context);
  }

  getBound(context, element, name, elementNs) {
    this.elementNs = elementNs;
    context.addBinding(new AttributeBinding(this, context, element, name));
    return getUnescapedValue(this.expression, context);
  }

  update(context, binding) {
    let value = getUnescapedValue(this.expression, context);
    const element = binding.element;
    const propertyName = !this.elementNs && UPDATE_PROPERTIES[binding.name];
    if (propertyName) {
      // Update via DOM property, short-circuiting if no update is needed.
      // Certain properties must be strings, so for those properties, the value gets stringified.
      //
      // There is one special case, when updating the string `input.value` property with a number.
      // If a user tries to type "1.01" in an `<input type="number">, then once they've typed "1.0",
      // the context value is set to `1`, triggering this update function to set the input value to
      // "1". That means typing "1.01" would be impossible without special handling to avoid
      // overwriting an existing input value of "1.0" with a new value of "1".
      if (element.tagName === 'INPUT' && propertyName === 'value' && typeof value === 'number') {
        if (parseFloat(element.value) === value) {
          return;
        }
      }
      const propertyValue = (STRING_PROPERTIES[binding.name]) ?
        this.stringify(value) : value;
      if (element[propertyName] === propertyValue) return;
      element[propertyName] = propertyValue;
      return;
    }
    if (value === false || value == null) {
      if (this.ns) {
        element.removeAttributeNS(this.ns, binding.name);
      } else {
        element.removeAttribute(binding.name);
      }
      return;
    }
    if (value === true) value = binding.name;
    if (this.ns) {
      element.setAttributeNS(this.ns, binding.name, value);
    } else {
      element.setAttribute(binding.name, value);
    }
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression, this.ns);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    return getDependencies(this.expression, context, options);
  }
}

function getUnescapedValue(expression: Expression, context: Context) {
  const unescaped = true;
  let value = expression.get(context, unescaped);
  while (value instanceof Template) {
    value = value.get(context, unescaped);
  }
  return value;
}

abstract class BaseElement<T> extends Template {
  attributes: Attributes;
  bindContentToValue: boolean;
  hooks: MarkupHook<any>[];
  notClosed: boolean;
  ns: string;
  selfClosing: boolean;
  startClose: string;
  tagName: T;
  unescapedContent: boolean;

  constructor(attributes, content, hooks, selfClosing, notClosed, ns) {
    super();
    this.attributes = attributes;
    this.content = content;
    this.hooks = hooks;
    this.selfClosing = selfClosing;
    this.notClosed = notClosed;
    this.ns = ns;
  }

  abstract getTagName(context): string;

  abstract getEndTag(tagName): string;

  get(context) {
    const tagName = this.getTagName(context);
    const endTag = this.getEndTag(tagName);
    const tagItems = [tagName];
    for (const key in this.attributes) {
      const value = this.attributes[key].get(context);
      if (value === true) {
        tagItems.push(key);
      } else if (value !== false && value != null) {
        tagItems.push(key + '="' + escapeAttribute(value) + '"');
      }
    }
    const startTag = '<' + tagItems.join(' ') + this.startClose;
    if (this.content) {
      const inner = contentHtml(this.content, context, this.unescapedContent);
      return startTag + inner + endTag;
    }
    return startTag + endTag;
  }

  appendTo(parent: Node, context: Context) {
    const tagName = this.getTagName(context);
    const element = (this.ns) ?
      document.createElementNS(this.ns, tagName) :
      document.createElement(tagName);
    for (const key in this.attributes) {
      const attribute = this.attributes[key];
      let value = attribute.getBound(context, element, key, this.ns);
      if (value === false || value == null) continue;
      const propertyName = !this.ns && CREATE_PROPERTIES[key];
      if (propertyName) {
        element[propertyName] = value;
        continue;
      }
      if (value === true) value = key;
      if (attribute.ns) {
        element.setAttributeNS(attribute.ns, key, value);
      } else {
        element.setAttribute(key, value);
      }
    }
    if (this.content) {
      this._bindContent(context, element);
      appendContent(element, this.content, context);
    }
    parent.appendChild(element);
    emitHooks(this.hooks, context, element);
  }

  attachTo(parent: Node, node, context) {
    const tagName = this.getTagName(context);
    if (
      !node ||
      node.nodeType !== 1 ||
      node.tagName.toLowerCase() !== tagName.toLowerCase()
    ) {
      throw attachError(parent, node);
    }
    for (const key in this.attributes) {
      // Get each attribute to create bindings
      this.attributes[key].getBound(context, node, key, this.ns);
      // TODO: Ideally, this would also check that the node's current attributes
      // are equivalent, but there are some tricky edge cases
    }
    if (this.content) {
      this._bindContent(context, node);
      attachContent(node, node.firstChild, this.content, context);
    }
    emitHooks(this.hooks, context, node);
    return node.nextSibling;
  }

  _bindContent(context, element) {
    // For textareas with dynamic text content, bind to the value property
    const child = this.bindContentToValue &&
      this.content.length === 1 &&
      this.content[0];
    if (child instanceof DynamicText) {
      child.unbound = true;
      const template = new DynamicAttribute(child.expression);
      context.addBinding(new AttributeBinding(template, context, element, 'value'));
    }
  }

  serialize(): string {
    return serializeObject.instance(
      this,
      this.tagName,
      this.attributes,
      this.content,
      this.hooks,
      this.selfClosing,
      this.notClosed,
      this.ns
    );
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const dependencies = concatMapDependencies(null, this.attributes, context, options);
    if (!this.content) return dependencies;
    return concatArrayDependencies(dependencies, this.content, context, options);
  }
}

export class Element extends BaseElement<string> {
  type = 'Element';
  endTag: string;

  constructor(tagName: string, attributes, content, hooks, selfClosing, notClosed, ns) {
    super(attributes, content, hooks, selfClosing, notClosed, ns);
    this.tagName = tagName;
    this.endTag = getEndTag(tagName, selfClosing, notClosed);
    this.startClose = getStartClose(selfClosing);
    const lowerTagName = tagName && tagName.toLowerCase();
    this.unescapedContent = (lowerTagName === 'script' || lowerTagName === 'style');
    this.bindContentToValue = (lowerTagName === 'textarea');
  }

  getTagName(_context) {
    return this.tagName;
  }

  getEndTag(_tagName) {
    return this.endTag;
  }
}

export class DynamicElement extends BaseElement<Expression> {
  type = 'DynamicElement';
  content: Template[];
  attributes: Attributes;

  constructor(tagName, attributes, content, hooks, selfClosing, notClosed, ns) {
    super(attributes, content, hooks, selfClosing, notClosed, ns);
    this.content = content;
    this.attributes = attributes;
    this.startClose = getStartClose(selfClosing);
    this.unescapedContent = false;
    this.tagName = tagName;
  }

  getTagName(context) {
    return getUnescapedValue(this.tagName, context);
  }

  getEndTag(tagName) {
    return getEndTag(tagName, this.selfClosing, this.notClosed);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const dependencies = super.dependencies(context, options);
    return concatDependencies(dependencies, this.tagName, context, options);
  }
}

function getStartClose(selfClosing: boolean) {
  return (selfClosing) ? ' />' : '>';
}

function getEndTag(tagName: string, selfClosing: boolean, notClosed: boolean) {
  const lowerTagName = tagName && tagName.toLowerCase();
  const isVoid = VOID_ELEMENTS[lowerTagName];
  return (isVoid || selfClosing || notClosed) ? '' : '</' + tagName + '>';
}

function getAttributeValue(element, name: string) {
  const propertyName = UPDATE_PROPERTIES[name];
  return (propertyName) ? element[propertyName] : element.getAttribute(name);
}

function emitHooks(hooks, context, value) {
  if (!hooks) return;
  context.queue(function queuedHooks() {
    for (let i = 0, len = hooks.length; i < len; i++) {
      hooks[i].emit(context, value);
    }
  });
}

abstract class BaseBlock extends Template {
  ending: string;
}

export class Block extends BaseBlock {
  type = 'Block';
  expression: Expression;

  constructor(expression: any, content: Template[]) {
    super();
    this.expression = expression;
    this.ending = '/' + expression;
    this.content = content;
  }

  get(context, unescaped) {
    const blockContext = context.child(this.expression);
    return contentHtml(this.content, blockContext, unescaped);
  }

  appendTo(parent: Node, context, binding) {
    const blockContext = context.child(this.expression);
    const start = document.createComment(this.expression.toString());
    const end = document.createComment(this.ending);
    const condition = this.getCondition(context);
    parent.appendChild(start);
    appendContent(parent, this.content, blockContext);
    parent.appendChild(end);
    updateRange(context, binding, this, start, end, null, condition);
  }

  attachTo(parent: Node, node, context) {
    const blockContext = context.child(this.expression);
    const start = document.createComment(this.expression.toString());
    const end = document.createComment(this.ending);
    const condition = this.getCondition(context);
    parent.insertBefore(start, node || null);
    node = attachContent(parent, node, this.content, blockContext);
    parent.insertBefore(end, node || null);
    updateRange(context, null, this, start, end, null, condition);
    return node;
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression, this.content);
  }

  update(context, binding) {
    if (!binding.start.parentNode) return;
    const condition = this.getCondition(context);
    // Cancel update if prior condition is equivalent to current value
    if (equalConditions(condition, binding.condition)) return;
    binding.condition = condition;
    // Get start and end in advance, since binding is mutated in getFragment
    const start = binding.start;
    const end = binding.end;
    const fragment = this.getFragment(context, binding);
    replaceRange(context, start, end, fragment, binding);
  }

  getCondition(context) {
    // We do an identity check to see if the value has changed before updating.
    // With objects, the object would still be the same, so this identity check
    // would fail to update enough. Thus, return NaN, which never equals anything
    // including itself, so that we always update on objects.
    //
    // We could also JSON stringify or use some other hashing approach. However,
    // that could be really expensive on gets of things that never change, and
    // is probably not a good tradeoff. Perhaps there should be a separate block
    // type that is only used in the case of dynamic updates
    const value = this.expression.get(context);
    return (typeof value === 'object') ? NaN : value;
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const dependencies = (this.expression.meta && this.expression.meta.blockType === 'on') ?
      getDependencies(this.expression, context, options) : null;
    const blockContext = context.child(this.expression);
    return concatArrayDependencies(dependencies, this.content, blockContext, options);
  }
}

export class ConditionalBlock extends BaseBlock {
  type = 'ConditionalBlock';
  expressions: Expression[];
  beginning: string;
  contents: Template[][];

  // @TODO: resolve expressions and contents (plural) with Block super call
  constructor(expressions, contents) {
    super();
    this.expressions = expressions;
    this.beginning = expressions.join('; ');
    this.ending = '/' + this.beginning;
    this.contents = contents;
  }

  get(context, unescaped) {
    const condition = this.getCondition(context);
    if (condition == null) return '';
    const expression = this.expressions[condition];
    const blockContext = context.child(expression);
    return contentHtml(this.contents[condition], blockContext, unescaped);
  }

  appendTo(parent: Node, context, binding) {
    const start = document.createComment(this.beginning);
    const end = document.createComment(this.ending);
    parent.appendChild(start);
    const condition = this.getCondition(context);
    if (condition != null) {
      const expression = this.expressions[condition];
      const blockContext = context.child(expression);
      appendContent(parent, this.contents[condition], blockContext);
    }
    parent.appendChild(end);
    updateRange(context, binding, this, start, end, null, condition);
  }

  attachTo(parent: Node, node, context) {
    const start = document.createComment(this.beginning);
    const end = document.createComment(this.ending);
    parent.insertBefore(start, node || null);
    const condition = this.getCondition(context);
    if (condition != null) {
      const expression = this.expressions[condition];
      const blockContext = context.child(expression);
      node = attachContent(parent, node, this.contents[condition], blockContext);
    }
    parent.insertBefore(end, node || null);
    updateRange(context, null, this, start, end, null, condition);
    return node;
  }

  serialize(): string {
    return serializeObject.instance(this, this.expressions, this.contents);
  }

  update(context, binding) {
    if (!binding.start.parentNode) return;
    const condition = this.getCondition(context);
    // Cancel update if prior condition is equivalent to current value
    if (equalConditions(condition, binding.condition)) return;
    binding.condition = condition;
    // Get start and end in advance, since binding is mutated in getFragment
    const start = binding.start;
    const end = binding.end;
    const fragment = this.getFragment(context, binding);
    replaceRange(context, start, end, fragment, binding);
  }

  getCondition(context) {
    for (let i = 0, len = this.expressions.length; i < len; i++) {
      if (this.expressions[i].truthy(context)) {
        return i;
      }
    }
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const condition = this.getCondition(context);
    if (condition == null) {
      return getDependencies(this.expressions[0], context, options);
    }
    const dependencies = concatSubArrayDependencies(null, this.expressions, context, options, condition);
    const expression = this.expressions[condition];
    const content = this.contents[condition];
    const blockContext = context.child(expression);
    return concatArrayDependencies(dependencies, content, blockContext, options);
  }
}

export class EachBlock extends Block {
  type = 'EachBlock';
  elseContent: Template[];

  constructor(expression, content, elseContent) {
    super(expression, content);
    this.ending = '/' + expression;
    this.elseContent = elseContent;
  }

  get(context, unescaped) {
    const items = this.expression.get(context);
    if (items && items.length) {
      let html = '';
      for (let i = 0, len = items.length; i < len; i++) {
        const itemContext = context.eachChild(this.expression, i);
        html += contentHtml(this.content, itemContext, unescaped);
      }
      return html;
    } else if (this.elseContent) {
      return contentHtml(this.elseContent, context, unescaped);
    }
    return '';
  }

  appendTo(parent: Node, context, binding) {
    const items = this.expression.get(context);
    const start = document.createComment(this.expression.toString());
    const end = document.createComment(this.ending);
    parent.appendChild(start);
    if (items && items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const itemContext = context.eachChild(this.expression, i);
        this.appendItemTo(parent, itemContext, start);
      }
    } else if (this.elseContent) {
      appendContent(parent, this.elseContent, context);
    }
    parent.appendChild(end);
    updateRange(context, binding, this, start, end);
  }

  appendItemTo(parent, context, itemFor, binding?) {
    const before = parent.lastChild;
    let start, end;
    appendContent(parent, this.content, context);
    if (before === parent.lastChild) {
      start = end = document.createComment('empty');
      parent.appendChild(start);
    } else {
      start = (before && before.nextSibling) || parent.firstChild;
      end = parent.lastChild;
    }
    updateRange(context, binding, this, start, end, itemFor);
  }

  attachTo(parent: Node, node, context) {
    const items = this.expression.get(context);
    const start = document.createComment(this.expression.toString());
    const end = document.createComment(this.ending);
    parent.insertBefore(start, node || null);
    if (items && items.length) {
      for (let i = 0, len = items.length; i < len; i++) {
        const itemContext = context.eachChild(this.expression, i);
        node = this.attachItemTo(parent, node, itemContext, start);
      }
    } else if (this.elseContent) {
      node = attachContent(parent, node, this.elseContent, context);
    }
    parent.insertBefore(end, node || null);
    updateRange(context, null, this, start, end);
    return node;
  }

  attachItemTo(parent, node, context, itemFor) {
    let start, end;
    const oldPrevious = node && node.previousSibling;
    const nextNode = attachContent(parent, node, this.content, context);
    if (nextNode === node) {
      start = end = document.createComment('empty');
      parent.insertBefore(start, node || null);
    } else {
      start = (oldPrevious && oldPrevious.nextSibling) || parent.firstChild;
      end = (nextNode && nextNode.previousSibling) || parent.lastChild;
    }
    updateRange(context, null, this, start, end, itemFor);
    return nextNode;
  }

  update(context, binding) {
    if (!binding.start.parentNode) return;
    const start = binding.start;
    const end = binding.end;
    if (binding.itemFor) {
      var fragment = document.createDocumentFragment();
      this.appendItemTo(fragment, context, binding.itemFor, binding);
    } else {
      var fragment = this.getFragment(context, binding);
    }
    replaceRange(context, start, end, fragment, binding);
  }

  insert(context, binding, index, howMany) {
    const parent = binding.start.parentNode;
    if (!parent) return;
    // In case we are inserting all of the items, update instead. This is needed
    // when we were previously rendering elseContent so that it is replaced
    if (index === 0 && this.expression.get(context).length === howMany) {
      return this.update(context, binding);
    }
    const node = indexStartNode(binding, index);
    const fragment = document.createDocumentFragment();
    for (let i = index, len = index + howMany; i < len; i++) {
      const itemContext = context.eachChild(this.expression, i);
      this.appendItemTo(fragment, itemContext, binding.start);
    }
    parent.insertBefore(fragment, node || null);
  }

  remove(context, binding, index, howMany) {
    const parent = binding.start.parentNode;
    if (!parent) return;
    // In case we are removing all of the items, update instead. This is needed
    // when elseContent should be rendered
    if (index === 0 && this.expression.get(context).length === 0) {
      return this.update(context, binding);
    }
    let node = indexStartNode(binding, index);
    let i = 0;
    while (node) {
      if (node === binding.end) return;
      if (node.$bindItemStart && node.$bindItemStart.itemFor === binding.start) {
        if (howMany === i++) return;
      }
      const nextNode = node.nextSibling;
      parent.removeChild(node);
      emitRemoved(context, node, binding);
      node = nextNode;
    }
  }

  move(context, binding, from, to, howMany) {
    const parent = binding.start.parentNode;
    if (!parent) return;
    let node = indexStartNode(binding, from);
    const fragment = document.createDocumentFragment();
    let i = 0;
    while (node) {
      if (node === binding.end) break;
      if (node.$bindItemStart && node.$bindItemStart.itemFor === binding.start) {
        if (howMany === i++) break;
      }
      const nextNode = node.nextSibling;
      fragment.appendChild(node);
      node = nextNode;
    }
    node = indexStartNode(binding, to);
    parent.insertBefore(fragment, node || null);
  }

  serialize(): string {
    return serializeObject.instance(this, this.expression, this.content, this.elseContent);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    let dependencies = getDependencies(this.expression, context, options);
    const items = this.expression.get(context);
    if (items && items.length) {
      for (let i = 0; i < items.length; i++) {
        const itemContext = context.eachChild(this.expression, i);
        dependencies = concatArrayDependencies(dependencies, this.content, itemContext, options);
      }
    } else if (this.elseContent) {
      dependencies = concatArrayDependencies(dependencies, this.elseContent, context, options);
    }
    return dependencies;
  }
}

//#region functions

function indexStartNode(binding, index: number) {
  let node = binding.start;
  let i = 0;
  while ((node = node.nextSibling)) {
    if (node === binding.end) return node;
    if (node.$bindItemStart && node.$bindItemStart.itemFor === binding.start) {
      if (index === i) return node;
      i++;
    }
  }
}

function updateRange(context, binding, template, start, end, itemFor?, condition?) {
  if (binding) {
    binding.start = start;
    binding.end = end;
    binding.condition = condition;
    setNodeBounds(binding, start, itemFor);
  } else {
    context.addBinding(new RangeBinding(template, context, start, end, itemFor, condition));
  }
}

function setNodeBounds(binding, start, itemFor) {
  if (itemFor) {
    setNodeProperty(start, '$bindItemStart', binding);
  } else {
    setNodeProperty(start, '$bindStart', binding);
  }
}

function appendContent(parent, content: Template[], context) {
  for (let i = 0, len = content.length; i < len; i++) {
    content[i].appendTo(parent, context);
  }
}

function attachContent(parent, node, content: Template[], context) {
  for (let i = 0, len = content.length; i < len; i++) {
    while (node && node.hasAttribute && node.hasAttribute('data-no-attach')) {
      node = node.nextSibling;
    }
    node = content[i].attachTo(parent, node, context);
  }
  return node;
}

function contentHtml(content: Template[], context, unescaped): string {
  let html = '';
  for (let i = 0, len = content.length; i < len; i++) {
    html += content[i].get(context, unescaped);
  }
  return html;
}

function replaceRange(context, start, end, fragment, binding, innerOnly?: boolean) {
  // Note: the calling function must make sure to check that there is a parent
  const parent = start.parentNode;
  // Copy item binding from old start to fragment being inserted
  if (start.$bindItemStart && fragment.firstChild) {
    setNodeProperty(fragment.firstChild, '$bindItemStart', start.$bindItemStart);
    start.$bindItemStart.start = fragment.firstChild;
  }
  // Fast path for single node replacements
  if (start === end) {
    parent.replaceChild(fragment, start);
    emitRemoved(context, start, binding);
    return;
  }
  // Remove all nodes from start to end
  let node = (innerOnly) ? start.nextSibling : start;
  let nextNode;
  while (node) {
    nextNode = node.nextSibling;
    emitRemoved(context, node, binding);
    if (innerOnly && node === end) {
      nextNode = end;
      break;
    }
    parent.removeChild(node);
    if (node === end) break;
    node = nextNode;
  }
  // This also works if nextNode is null, by doing an append
  parent.insertBefore(fragment, nextNode || null);
}

function emitRemoved(context: Context, node: Node, ignore: boolean) {
  context.removeNode(node);
  emitRemovedBinding(context, ignore, node, '$bindNode');
  emitRemovedBinding(context, ignore, node, '$bindStart');
  emitRemovedBinding(context, ignore, node, '$bindItemStart');
  // @ts-expect-error Property `$bindAttributes` not on Node
  const attributes = node.$bindAttributes;
  if (attributes) {
    // @ts-expect-error Property `$bindAttributes` not on Node
    node.$bindAttributes = null;
    for (const key in attributes) {
      context.removeBinding(attributes[key]);
    }
  }
  for (node = node.firstChild; node; node = node.nextSibling) {
    emitRemoved(context, node, ignore);
  }
}

function emitRemovedBinding(context: Context, ignore, node: Node, property: string) {
  const binding = node[property];
  if (binding) {
    node[property] = null;
    if (binding !== ignore) {
      context.removeBinding(binding);
    }
  }
}

function attachError(parent: Node, node: Node) {
  if (typeof console !== 'undefined') {
    console.error('Attach failed for', node, 'within', parent);
  }
  return new Error('Attaching bindings failed, because HTML structure ' +
    'does not match client rendering.'
  );
}

//#endregion

export class Binding {
  type = 'Binding';
  meta: any;
  context: Context;
  template: any;

  constructor() {
    this.meta = null;
  }

  update() {
    this.context.pause();
    this.template.update(this.context, this);
    this.context.unpause();
  }

  insert(_index, _howMany) {
    this.update();
  }

  remove(_index, _howMany) {
    this.update();
  }

  move(_from, _to, _howMany) {
    this.update();
  }

  isUnbound() {
    return this.template.expression.isUnbound(this.context);
  }
}

export class NodeBinding extends Binding {
  type = 'NodeBinding';
  node: Node;

  constructor(template, context, node) {
    super();
    this.template = template;
    this.context = context;
    this.node = node;
    this.meta = null;
    setNodeProperty(node, '$bindNode', this);
  }
}

export class AttributeBindingsMap { }

export class AttributeBinding extends Binding {
  type = 'AttributeBinding';
  element: Element;
  name: string;

  constructor(template, context, element, name) {
    super();
    this.template = template;
    this.context = context;
    this.element = element;
    this.name = name;
    this.meta = null;
    const map = element.$bindAttributes ||
      (element.$bindAttributes = new AttributeBindingsMap());
    map[name] = this;
  }
}

export class RangeBinding extends Binding {
  type = 'RangeBinding';
  start: any;
  end: any;
  itemFor: any;
  condition: any;

  constructor(template, context, start, end, itemFor, condition) {
    super();
    this.template = template;
    this.context = context;
    this.start = start;
    this.end = end;
    this.itemFor = itemFor;
    this.condition = condition;
    this.meta = null;
    setNodeBounds(this, start, itemFor);
  }

  insert(index, howMany) {
    this.context.pause();
    if (this.template.insert) {
      this.template.insert(this.context, this, index, howMany);
    } else {
      this.template.update(this.context, this);
    }
    this.context.unpause();
  }

  remove(index, howMany) {
    this.context.pause();
    if (this.template.remove) {
      this.template.remove(this.context, this, index, howMany);
    } else {
      this.template.update(this.context, this);
    }
    this.context.unpause();
  }

  move(from, to, howMany) {
    this.context.pause();
    if (this.template.move) {
      this.template.move(this.context, this, from, to, howMany);
    } else {
      this.template.update(this.context, this);
    }
    this.context.unpause();
  }
}

//#region
/// Utility functions ///

function noop() { }

function mergeInto(from, to) {
  for (const key in from) {
    to[key] = from[key];
  }
}

function escapeHtml(string: string): string {
  string = string + '';
  return string.replace(/[&<]/g, function(match) {
    return (match === '&') ? '&amp;' : '&lt;';
  });
}

function escapeAttribute(string: string): string {
  string = string + '';
  return string.replace(/[&"]/g, function(match) {
    return (match === '&') ? '&amp;' : '&quot;';
  });
}

function equalConditions(a: any, b: any): boolean {
  // First, test for strict equality
  if (a === b) return true;
  // Failing that, allow for template objects used as a condition to define a
  // custom `equals()` method to indicate equivalence
  return (a instanceof Template) && a.equals(b);
}

//#endregion

export const emptyTemplate = new Template([]);

//#region Shims & workarounds ////

// General notes:
//
// In all cases, Node.insertBefore should have `|| null` after its second
// argument. IE works correctly when the argument is ommitted or equal
// to null, but it throws and error if it is equal to undefined.

if (!Array.isArray) {
  // @ts-expect-error Shim defining Array.isArray
  Array.isArray = function(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  };
}

// Equivalent to textNode.splitText, which is buggy in IE <=9
function splitData(node, index) {
  const newNode = node.cloneNode(false);
  newNode.deleteData(0, index);
  node.deleteData(index, node.length - index);
  node.parentNode.insertBefore(newNode, node.nextSibling || null);
  return newNode;
}

// Defined so that it can be overriden in IE <=8
let setNodeProperty = (node, key, value) => {
  return node[key] = value;
}

let normalizeLineBreaks = (value: string) => value;

(function() {
  // Don't try to shim in Node.js environment
  if (typeof document === 'undefined') return;

  const div = document.createElement('div');
  div.innerHTML = '\r\n<br>\n'
  // @ts-expect-error Property `data` does not exist on ChildNode
  const windowsLength = div.firstChild.data.length;
  // @ts-expect-error Property `data` does not exist on ChildNode
  const unixLength = div.lastChild.data.length;
  if (windowsLength === 1 && unixLength === 1) {
    normalizeLineBreaks = function(value: string) {
      return value.replace(/\r\n/g, '\n');
    };
  } else if (windowsLength === 2 && unixLength === 2) {
    normalizeLineBreaks = function(value: string) {
      return value.replace(/(^|[^\r])(\n+)/g, function(match, value, newLines) {
        for (let i = newLines.length; i--;) {
          value += '\r\n';
        }
        return value;
      });
    };
  }

  // TODO: Shim createHtmlFragment for old IE

  // TODO: Shim setAttribute('style'), which doesn't work in IE <=7
  // http://webbugtrack.blogspot.com/2007/10/bug-245-setattribute-style-does-not.html

  // TODO: Investigate whether input name attribute works in IE <=7. We could
  // override Element::appendTo to use IE's alternative createElement syntax:
  // document.createElement('<input name="xxx">')
  // http://webbugtrack.blogspot.com/2007/10/bug-235-createelement-is-broken-in-ie.html

  // In IE, input.defaultValue doesn't work correctly, so use input.value,
  // which mistakenly but conveniently sets both the value property and attribute.
  //
  // Surprisingly, in IE <=7, input.defaultChecked must be used instead of
  // input.checked before the input is in the document.
  // http://webbugtrack.blogspot.com/2007/11/bug-299-setattribute-checked-does-not.html
  const input = document.createElement('input');
  input.defaultValue = 'x';
  if (input.value !== 'x') {
    CREATE_PROPERTIES.value = 'value';
  }

  try {
    // TextNodes are not expando in IE <=8
    // @ts-expect-error $try does not exist on Text
    document.createTextNode('').$try = 0;
  } catch (err) {
    setNodeProperty = function(node, key, value) {
      // If trying to set a property on a TextNode, create a proxy CommentNode
      // and set the property on that node instead. Put the proxy after the
      // TextNode if marking the end of a range, and before otherwise.
      if (node.nodeType === 3) {
        let proxyNode = node.previousSibling;
        if (!proxyNode || proxyNode.$bindProxy !== node) {
          proxyNode = document.createComment('proxy');
          proxyNode.$bindProxy = node;
          node.parentNode.insertBefore(proxyNode, node || null);
        }
        return proxyNode[key] = value;
      }
      // Set the property directly on other node types
      return node[key] = value;
    };
  }
})();

//#endregion

function concatSubArrayDependencies(dependencies, expressions, context, options, end) {
  for (let i = 0; i <= end; i++) {
    dependencies = concatDependencies(dependencies, expressions[i], context, options);
  }
  return dependencies;
}

function concatArrayDependencies(dependencies, expressions, context, options) {
  for (let i = 0; i < expressions.length; i++) {
    dependencies = concatDependencies(dependencies, expressions[i], context, options);
  }
  return dependencies;
}

function concatMapDependencies(dependencies, expressions, context, options) {
  for (const key in expressions) {
    dependencies = concatDependencies(dependencies, expressions[key], context, options);
  }
  return dependencies;
}

function concatDependencies(dependencies, expression, context, options) {
  const expressionDependencies = getDependencies(expression, context, options);
  return concat(dependencies, expressionDependencies);
}

function getDependencies(expression, context, options) {
  return expression.dependencies(context, options);
}

const markerHooks = [{
  emit: function(context, node) {
    node.$component = context.controller;
    context.controller.markerNode = node;
  }
}];

export class Marker extends Comment {
  type = 'Marker';

  constructor(data) {
    super(data, markerHooks);
  }

  serialize(): string {
    return serializeObject.instance(this, this.data);
  }

  get() {
    return '';
  }
}

function ViewAttributesMap(source) {
  const items = source.split(/\s+/);
  for (let i = 0, len = items.length; i < len; i++) {
    this[items[i]] = true;
  }
}

function ViewArraysMap(source) {
  const items = source.split(/\s+/);
  for (let i = 0, len = items.length; i < len; i++) {
    const item = items[i].split('/');
    this[item[0]] = item[1] || item[0];
  }
}

export class View extends Template {
  arraysMap: any;
  attributesMap: any;
  componentFactory: any;
  fromSerialized: boolean;
  literal: boolean;
  name: string;
  namespace: string;
  options: any;
  registeredName: string;
  string: boolean;
  template: any;
  type = 'View';
  unminified: boolean;
  views: any;

  constructor(views, name, source, options) {
    super();
    this.views = views;
    this.name = name;
    this.source = source;
    this.options = options;

    const nameSegments = (this.name || '').split(':');
    const lastSegment = nameSegments.pop();
    this.namespace = nameSegments.join(':');
    this.registeredName = (lastSegment === 'index') ? this.namespace : this.name;

    this.attributesMap = options && options.attributes &&
      new ViewAttributesMap(options.attributes);
    this.arraysMap = options && options.arrays &&
      new ViewArraysMap(options.arrays);
    // The empty string is considered true for easier HTML attribute parsing
    this.unminified = options && (options.unminified || options.unminified === '');
    this.string = options && (options.string || options.string === '');
    this.literal = options && (options.literal || options.literal === '');
    this.template = null;
    this.componentFactory = null;
    this.fromSerialized = false;
  }

  serialize(): string {
    return null;
  }

  _isComponent(context) {
    if (!this.componentFactory) return false;
    if (context.attributes && context.attributes.extend) return false;
    return true;
  }

  _initComponent(context) {
    return (this._isComponent(context)) ?
      this.componentFactory.init(context) : context;
  }

  _queueCreate(context, viewContext) {
    if (this._isComponent(context)) {
      const componentFactory = this.componentFactory;
      context.queue(function queuedCreate() {
        componentFactory.create(viewContext);
      });

      if (!context.hooks) return;
      context.queue(function queuedComponentHooks() {
        // Kick off hooks if view instance specified `on` or `as` attributes
        for (let i = 0, len = context.hooks.length; i < len; i++) {
          context.hooks[i].emit(context, viewContext.controller);
        }
      });
    }
  }

  get(context, unescaped) {
    const viewContext = this._initComponent(context);
    const template = this.template || this.parse();
    return template.get(viewContext, unescaped);
  }

  getFragment(context, binding) {
    const viewContext = this._initComponent(context);
    const template = this.template || this.parse();
    const fragment = template.getFragment(viewContext, binding);
    this._queueCreate(context, viewContext);
    return fragment;
  }

  appendTo(parent: Node, context) {
    const viewContext = this._initComponent(context);
    const template = this.template || this.parse();
    template.appendTo(parent, viewContext);
    this._queueCreate(context, viewContext);
  }

  attachTo(parent: Node, node, context) {
    const viewContext = this._initComponent(context);
    const template = this.template || this.parse();
    var node = template.attachTo(parent, node, viewContext);
    this._queueCreate(context, viewContext);
    return node;
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const template = this.template || this.parse();
    // We can't figure out relative path dependencies within a component without
    // rendering it, because each component instance's scope is dynamically set
    // based on its unique `id` property. To represent this, set the context
    // controller to `null`.
    //
    // Under normal rendering conditions, contexts should always have reference
    // to a controller. Expression::get() methods use the reference to
    // `context.controller.model.data` to lookup values, and paths are resolved
    // based on `context.controller.model._scope`.
    //
    // To handle this, Expression methods guard against a null controller by not
    // returning any dependencies for model paths. In addition, they return
    // `undefined` from get, which affect dependencies computed for
    // ConditionalBlock and EachBlock, as their dependencies will differ based
    // on the value of model data.
    //
    // TODO: This likely under-estimates the true dependencies within a
    // template. However, to provide a more complete view of dependencies, we'd
    // need information we only have at render time, namely, the scope and data
    // within the component model. This may indicate that Derby should use a
    // more Functional Reactive Programming (FRP)-like approach of having
    // dependencies be returned from getFragment and attach methods along with
    // DOM nodes rather than computing dependencies separately from rendering.
    const viewContext = (this._isComponent(context)) ?
      context.componentChild(null) : context;
    return template.dependencies(viewContext, options);
  }

  parse() {
    this._parse();
    if (this.componentFactory && !this.componentFactory.constructor.prototype.singleton) {
      const marker = new Marker(this.name);
      this.template.content.unshift(marker);
    }
    return this.template;
  }

  // _parse is defined in parsing.js, so that it doesn't have to
  // be included in the client if templates are all parsed server-side
  _parse() {
    throw new Error('View parsing not available');
  }
}

abstract class BaseViewInstance extends Template {
  attributes: any;
  hooks: any;
  initHooks: any;

  get(context, unescaped) {
    const view = this._find(context);
    const viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
    return view.get(viewContext, unescaped);
  }

  getFragment(context, binding) {
    const view = this._find(context);
    const viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
    return view.getFragment(viewContext, binding);
  }

  appendTo(parent: Node, context) {
    const view = this._find(context);
    const viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
    view.appendTo(parent, viewContext);
  }

  attachTo(parent: Node, node, context) {
    const view = this._find(context);
    const viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
    return view.attachTo(parent, node, viewContext);
  }

  abstract _find(_context): any;
}

export class ViewInstance extends BaseViewInstance {
  type = 'ViewInstance';
  name: string;
  view: any;

  constructor(name, attributes, hooks, initHooks) {
    super();
    this.name = name;
    this.attributes = attributes;
    this.hooks = hooks;
    this.initHooks = initHooks;
    this.view = null;
  }

  serialize(): string {
    return serializeObject.instance(this, this.name, this.attributes, this.hooks, this.initHooks);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const view = this._find(context);
    const viewContext = context.viewChild(view, this.attributes, this.hooks, this.initHooks);
    return view.dependencies(viewContext, options);
  }

  _find(context) {
    if (this.view) return this.view;
    const contextView = context.getView();
    const namespace = contextView && contextView.namespace;
    this.view = context.meta.views.find(this.name, namespace);
    if (!this.view) {
      const message = context.meta.views.findErrorMessage(this.name, contextView);
      throw new Error(message);
    }
    return this.view;
  }
}

export class DynamicViewInstance extends BaseViewInstance {
  type = 'DynamicViewInstance';
  nameExpression: any;

  constructor(nameExpression, attributes, hooks, initHooks) {
    super();
    this.attributes = attributes;
    this.hooks = hooks;
    this.initHooks = initHooks;
    this.nameExpression = nameExpression;
  }

  serialize(): string {
    return serializeObject.instance(this, this.nameExpression, this.attributes, this.hooks, this.initHooks);
  }

  _find(context) {
    const name = this.nameExpression.get(context);
    const contextView = context.getView();
    const namespace = contextView && contextView.namespace;
    const view = name && context.meta.views.find(name, namespace);
    return view || exports.emptyTemplate;
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const nameDependencies = this.nameExpression.dependencies(context);
    const viewDependencies = ViewInstance.prototype.dependencies.call(this, context, options);
    return concat(nameDependencies, viewDependencies);
  }
}

// Without a ContextClosure, ViewParent will return the nearest context that
// is the parent of a view instance. When a context with a `closure` property
// is encountered first, ViewParent will find the specific referenced context,
// even if it is further up the context hierarchy.
export class ViewParent extends Template {
  type = 'ViewParent';
  template: any;

  constructor(template) {
    super();
    this.template = template;
  }

  serialize(): string {
    return serializeObject.instance(this, this.template);
  }

  get(context, unescaped) {
    const parentContext = context.forViewParent();
    return this.template.get(parentContext, unescaped);
  }

  getFragment(context, binding) {
    const parentContext = context.forViewParent();
    return this.template.getFragment(parentContext, binding);
  }

  appendTo(parent: Node, context) {
    const parentContext = context.forViewParent();
    this.template.appendTo(parent, parentContext);
  }

  attachTo(parent: Node, node, context) {
    const parentContext = context.forViewParent();
    return this.template.attachTo(parent, node, parentContext);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this, options)) return;
    const parentContext = context.forViewParent();
    return this.template.dependencies(parentContext, options);
  }
}

// At render time, this template creates a context child and sets its
// `closure` property to a fixed reference. It is used in combination with
// ViewParent in order to control which context is returned.
//
// Instances of this template cannot be serialized. It is intended for use
// dynamically during rendering only.
export class ContextClosure extends Template {
  template: Template;
  context: Context;

  constructor(template, context) {
    super();
    this.template = template;
    this.context = context;
  }

  serialize(): string {
    throw new Error('ContextClosure cannot be serialized');
  }

  get(context, unescaped) {
    const closureContext = context.closureChild(this.context);
    return this.template.get(closureContext, unescaped);
  }

  getFragment(context, binding) {
    const closureContext = context.closureChild(this.context);
    return this.template.getFragment(closureContext, binding);
  }

  appendTo(parent: Node, context) {
    const closureContext = context.closureChild(this.context);
    this.template.appendTo(parent, closureContext);
  }

  attachTo(parent: Node, node, context) {
    const closureContext = context.closureChild(this.context);
    return this.template.attachTo(parent, node, closureContext);
  }

  dependencies(context, options) {
    if (DependencyOptions.shouldIgnoreTemplate(this.template, options)) return;
    const closureContext = context.closureChild(this.context);
    return this.template.dependencies(closureContext, options);
  }

  equals(other) {
    return (other instanceof ContextClosure) &&
      (this.context === other.context) &&
      (this.template.equals(other.template));
  }
}

class ViewsMap { }

export class Views {
  nameMap: ViewsMap;
  tagMap: ViewsMap;
  // @deprecated: elementMap is deprecated and should be removed with Derby 0.6.0
  elementMap: ViewsMap;

  constructor() {
    this.nameMap = new ViewsMap();
    this.tagMap = new ViewsMap();
    // TODO: elementMap is deprecated and should be removed with Derby 0.6.0
    this.elementMap = this.tagMap;
  }

  find(name, namespace) {
    const map = this.nameMap;

    // Exact match lookup
    const exactName = (namespace) ? namespace + ':' + name : name;
    var match = map[exactName];
    if (match) return match;

    // Relative lookup
    let segments = name.split(':');
    let segmentsDepth = segments.length;
    if (namespace) segments = namespace.split(':').concat(segments);
    // Iterate through segments, leaving the `segmentsDepth` segments and
    // removing the second to `segmentsDepth` segment to traverse up the
    // namespaces. Decrease `segmentsDepth` if not found and repeat again.
    while (segmentsDepth > 0) {
      const testSegments = segments.slice();
      while (testSegments.length > segmentsDepth) {
        testSegments.splice(-1 - segmentsDepth, 1);
        const testName = testSegments.join(':');
        var match = map[testName];
        if (match) return match;
      }
      segmentsDepth--;
    }
  }

  register(name, source, options) {
    const mapName = name.replace(/:index$/, '');
    let view = this.nameMap[mapName];
    if (view) {
      // Recreate the view if it already exists. We re-apply the constructor
      // instead of creating a new view object so that references to object
      // can be cached after finding the first time
      const componentFactory = view.componentFactory;
      View.call(view, this, name, source, options);
      view.componentFactory = componentFactory;
    } else {
      view = new View(this, name, source, options);
    }
    this.nameMap[mapName] = view;
    // TODO: element is deprecated and should be removed with Derby 0.6.0
    const tagName = options && (options.tag || options.element);
    if (tagName) this.tagMap[tagName] = view;
    return view;
  }

  deserialize(items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const setTemplate = item[0];
      const name = item[1];
      const source = item[2];
      const options = item[3];
      const view = this.register(name, source, options);
      view.parse = setTemplate;
      view.fromSerialized = true;
    }
  }

  serialize(options) {
    const forServer = options && options.server;
    const minify = options && options.minify;
    const items = [];
    for (const name in this.nameMap) {
      const view = this.nameMap[name];
      let template = view.template || view.parse();
      if (!forServer && view.options) {
        // Do not serialize views with the `serverOnly` option, except when
        // serializing for a server script
        if (view.options.serverOnly) continue;
        // For views with the `server` option, serialize them with a blank
        // template body. This allows them to be used from other views on the
        // browser, but they will output nothing on the browser
        if (view.options.server) template = exports.emptyTemplate;
      }
      // Serializing views as a function allows them to be constructed lazily upon
      // first use. This can improve initial load times of the application when
      // there are many views
      items.push(
        '[function(){return this.template=' +
        template.serialize() + '},' +
        serializeObject.args([
          view.name,
          (minify) ? null : view.source,
          (hasKeys(view.options)) ? view.options : null
        ]) +
        ']'
      );
    }
    return 'function(derbyTemplates, views){' +
      'var expressions = derbyTemplates.expressions,' +
      'templates = derbyTemplates.templates;' +
      'views.deserialize([' + items.join(',') + '])}';
  }

  findErrorMessage(name, contextView) {
    const names = Object.keys(this.nameMap);
    let message = 'Cannot find view "' + name + '" in' +
      [''].concat(names).join('\n  ') + '\n';
    if (contextView) {
      message += '\nWithin template "' + contextView.name + '":\n' + contextView.source;
    }
    return message;
  }
}

export abstract class MarkupHook<T> {
  module = Template.prototype.module;
  name: string;
  abstract emit(context: Context, target: T): void;
}

export class ElementOn extends MarkupHook<Element> {
  type = 'ElementOn';
  name: string;
  expression: any;

  constructor(name, expression) {
    super();
    this.name = name;
    this.expression = expression;
  }

  serialize(): string {
    return serializeObject.instance(this, this.name, this.expression);
  }

  emit(context, element) {
    if (this.name === 'create') {
      this.apply(context, element);
      return;
    }
    const elementOn = this;
    const listener = function elementOnListener(event) {
      return elementOn.apply(context, element, event);
    };
    // Using `context.controller.dom.on` would be better for garbage collection,
    // but since it synchronously removes listeners on component destroy, it would
    // break existing code relying on `on-*` listeners firing as a component is
    // being destroyed. Even with `addEventListener`, browsers should still GC
    // the listeners once there are no references to the element.
    element.addEventListener(this.name, listener, false);
    // context.controller.dom.on(this.name, element, listener, false);
  }

  apply(context, element, event?) {
    const modelData = context.controller.model.data;
    modelData.$event = event;
    modelData.$element = element;
    const out = this.expression.apply(context);
    delete modelData.$event;
    delete modelData.$element;
    return out;
  }
}

export class ComponentOn extends MarkupHook<any> {
  type = 'ComponentOn';
  name: string;
  expression: any;

  constructor(name, expression) {
    super();
    this.name = name;
    this.expression = expression;
  }

  serialize(): string {
    return serializeObject.instance(this, this.name, this.expression);
  }

  emit(context, component) {
    const expression = this.expression;
    component.on(this.name, function componentOnListener(...args) {
      return expression.apply(context, args);
    });
  }
}

export class AsProperty extends MarkupHook<any> {
  type = 'AsProperty';
  segments: any;
  lastSegment: any;

  constructor(segments) {
    super();
    this.segments = segments;
    this.lastSegment = segments.pop();
  }

  serialize(): string {
    const segments = this.segments.concat(this.lastSegment);
    return serializeObject.instance(this, segments);
  }

  emit(context, target) {
    const node = traverseAndCreate(context.controller, this.segments);
    node[this.lastSegment] = target;
    this.addListeners(target, node, this.lastSegment);
  }

  addListeners(target, object, key) {
    this.addDestroyListener(target, function asPropertyDestroy() {
      // memoize initial reference so we dont destroy
      // property that has been replaced with a different reference
      const intialRef = object[key];
      process.nextTick(function deleteProperty() {
        if (intialRef !== object[key]) {
          return;
        }
        delete object[key];
      });
    });
  }

  addDestroyListener = elementAddDestroyListener;
}

export class AsPropertyComponent extends AsProperty {
  type = 'AsPropertyComponent';

  constructor(segments) {
    super(segments);
  }

  addDestroyListener = componentAddDestroyListener;
}

export class AsObject extends AsProperty {
  type = 'AsObject';
  keyExpression: any;

  constructor(segments, keyExpression) {
    super(segments);
    this.keyExpression = keyExpression;
  }

  serialize(): string {
    const segments = this.segments.concat(this.lastSegment);
    return serializeObject.instance(this, segments, this.keyExpression);
  }

  emit(context, target) {
    const node = traverseAndCreate(context.controller, this.segments);
    const object = node[this.lastSegment] || (node[this.lastSegment] = {});
    const key = this.keyExpression.get(context);
    object[key] = target;
    this.addListeners(target, object, key);
  }
}

export class AsObjectComponent extends AsObject {
  type = 'AsObjectComponent';

  constructor(segments, keyExpression) {
    super(segments, keyExpression);
  }

  addDestroyListener = componentAddDestroyListener;
}

export class AsArray extends AsProperty {
  type = 'AsArray';

  constructor(segments) {
    super(segments);
  }

  emit(context, target) {
    const node = traverseAndCreate(context.controller, this.segments);
    const array = node[this.lastSegment] || (node[this.lastSegment] = []);

    // Iterate backwards, since rendering will usually append
    for (let i = array.length; i--;) {
      const item = array[i];
      // Don't add an item if already in the array
      if (item === target) return;
      const mask = this.comparePosition(target, item);
      // If the emitted target is after the current item in the document,
      // insert it next in the array
      // Node.DOCUMENT_POSITION_FOLLOWING = 4
      if (mask & 4) {
        array.splice(i + 1, 0, target);
        this.addListeners(target, array);
        return;
      }
    }
    // Add to the beginning if before all items
    array.unshift(target);
    this.addListeners(target, array);
  }

  addListeners(target, array) {
    this.addDestroyListener(target, function asArrayDestroy() {
      removeArrayItem(array, target);
    });
  }

  comparePosition(target, item) {
    return item.compareDocumentPosition(target);
  }
}

export class AsArrayComponent extends AsArray {
  type = 'AsArrayComponent';

  constructor(segments) {
    super(segments);
  }

  comparePosition(target, item) {
    return item.markerNode.compareDocumentPosition(target.markerNode);
  }

  addDestroyListener = componentAddDestroyListener;
}

export function elementAddDestroyListener(element, listener) {
  const destroyListeners = element.$destroyListeners;
  if (destroyListeners) {
    if (destroyListeners.indexOf(listener) === -1) {
      destroyListeners.push(listener);
    }
  } else {
    element.$destroyListeners = [listener];
  }
}

export function elementRemoveDestroyListener(element, listener) {
  const destroyListeners = element.$destroyListeners;
  if (destroyListeners) {
    removeArrayItem(destroyListeners, listener);
  }
}

function componentAddDestroyListener(target, listener) {
  target.on('destroy', listener);
}

function removeArrayItem(array, item) {
  const index = array.indexOf(item);
  if (index > -1) {
    array.splice(index, 1);
  }
}
