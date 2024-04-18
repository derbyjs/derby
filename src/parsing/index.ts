import * as path from 'path';

import htmlUtil = require('html-util');

import { createPathExpression } from './createPathExpression';
import { markup } from './markup';
import { AppForClient, App } from '../App';
import { templates, expressions } from '../templates';
import { Expression } from '../templates/expressions';
import { MarkupHook, View } from '../templates/templates';
import { checkKeyIsSafe } from '../templates/util';

export { createPathExpression } from './createPathExpression';
export { markup } from './markup';

declare module '../App' {
  interface AppForClient {
    addViews(file: string, namespace: string): void;
  }
}

interface ParsedView {
  name: string;
  source: string;
  options: unknown;
  filename?: string;
}

// View.prototype._parse is defined here, so that it doesn't have to
// be included in the client if templates are all parsed server-side
templates.View.prototype._parse = function() {
  // Wrap parsing in a try / catch to add context to message when throwing
  let template;
  try {
    if (this.literal) {
      const source = (this.unminified) ? this.source :
        // Remove leading and trailing whitespace only lines by default
        this.source.replace(/^\s*\n/, '').replace(/\s*$/, '');
      template = new templates.Text(source);
    } else if (this.string) {
      template = createStringTemplate(this.source, this);
    } else {
      const source = (this.unminified) ? this.source :
        htmlUtil.minify(this.source).replace(/&sp;/g, ' ');
      template = createTemplate(source, this);
    }
  } catch (err) {
    const message = '\n\nWithin template "' + this.name + '":\n' + this.source;
    throw appendErrorMessage(err, message);
  }
  this.template = template;
  return template;
};

// Modified and shared among the following parse functions. It's OK for this
// to be shared at the module level, since it is only used by synchronous code
let parseNode: ParseNode;

export function createTemplate(source: string, view: View) {
  source = escapeBraced(source);
  parseNode = new ParseNode(view);
  htmlUtil.parse(source, {
    start: parseHtmlStart,
    end: parseHtmlEnd,
    text: parseHtmlText,
    comment: parseHtmlComment,
    other: parseHtmlOther
  });
  // Allow for certain elements at the end of a template to not be closed. This
  // is especially important so that </body> and </html> tags can be omitted,
  // since Derby sends an additional script tag after the HTML for the page
  while (parseNode.parent) {
    parseNode = parseNode.parent;
    const last = parseNode.last();
    if (last instanceof templates.Element) {
      if (last.tagName === 'body' || last.tagName === 'html') {
        last.notClosed = true;
        last.endTag = '';
        continue;
      } else {
        throw new Error('Missing closing HTML tag: ' + last.endTag);
      }
    }
    unexpected();
  }
  return new templates.Template(parseNode.content);
}

export function createStringTemplate(source: string, view: View) {
  source = escapeBraced(source);
  parseNode = new ParseNode(view);
  parseText(source, parseTextLiteral, parseTextExpression, 'string');
  return new templates.Template(parseNode.content);
}

function parseHtmlStart(tag: string, tagName: string, attributes: Record<string, string>, selfClosing: boolean) {
  const lowerTagName = tagName.toLowerCase();
  let hooks;
  if (lowerTagName !== 'view' && !viewForTagName(lowerTagName)) {
    hooks = elementHooksFromAttributes(attributes);
  }
  const attributesMap = parseAttributes(attributes);
  const namespaceUri = (lowerTagName === 'svg') ?
    templates.NAMESPACE_URIS.svg : parseNode.namespaceUri;
  let Constructor: any = templates.Element;
  if (lowerTagName === 'tag') {
    Constructor = templates.DynamicElement;
    tagName = attributesMap.is;
    delete attributesMap.is;
  }
  if (selfClosing || templates.VOID_ELEMENTS[lowerTagName]) {
    const element = new Constructor(tagName, attributesMap, null, hooks, selfClosing, null, namespaceUri);
    parseNode.content.push(element);
    parseElementClose(lowerTagName);
  } else {
    parseNode = parseNode.child();
    parseNode.namespaceUri = namespaceUri;
    const element = new Constructor(tagName, attributesMap, parseNode.content, hooks, selfClosing, null, namespaceUri);
    parseNode.parent.content.push(element);
  }
}

function parseAttributes(attributes: Record<string, string>) {
  let attributesMap;
  for (const key in attributes) {
    checkKeyIsSafe(key);
    if (!attributesMap) attributesMap = {};

    const value = attributes[key];
    const match = /([^:]+):[^:]/.exec(key);
    const nsUri = match && templates.NAMESPACE_URIS[match[1]];
    if (value === '' || typeof value !== 'string') {
      attributesMap[key] = new templates.Attribute(value, nsUri);
      continue;
    }

    parseNode = parseNode.child();
    parseText(value, parseTextLiteral, parseTextExpression, 'attribute');

    if (parseNode.content.length === 1) {
      const item = parseNode.content[0];
      attributesMap[key] =
        (item instanceof templates.Text) ?
          new templates.Attribute(item.data, nsUri) :
          (item instanceof templates.DynamicText) ?
            (item.expression instanceof expressions.LiteralExpression) ?
              new templates.Attribute(item.expression.value, nsUri) :
              new templates.DynamicAttribute(item.expression, nsUri)
            :
            new templates.DynamicAttribute(item, nsUri);

    } else if (parseNode.content.length > 1) {
      const template = new templates.Template(parseNode.content, value);
      // @ts-expect-error template can be Expression or Template
      attributesMap[key] = new templates.DynamicAttribute(template, nsUri);

    } else {
      throw new Error('Error parsing ' + key + ' attribute: ' + value);
    }

    parseNode = parseNode.parent;
  }
  return attributesMap;
}

function parseHtmlEnd(tag: string, tagName: string) {
  parseNode = parseNode.parent;
  const last = parseNode.last();
  if (!(
    (last instanceof templates.DynamicElement && tagName.toLowerCase() === 'tag') ||
    (last instanceof templates.Element && last.tagName === tagName)
  )) {
    throw new Error('Mismatched closing HTML tag: ' + tag);
  }
  parseElementClose(tagName);
}

function parseElementClose(tagName: string) {
  if (tagName === 'view') {
    const element = parseNode.content.pop();
    parseViewElement(element);
    return;
  }
  const view = viewForTagName(tagName);
  if (view) {
    const element = parseNode.content.pop();
    parseNamedViewElement(element, view, view.name);
    return;
  }
  const element = parseNode.last();
  markup.emit('element', element);
  markup.emit('element:' + tagName, element);
}

function viewForTagName(tagName: string) {
  return parseNode.view && parseNode.view.views.tagMap[tagName];
}

function parseHtmlText(data: string, isRawText: boolean) {
  const environment = (isRawText) ? 'string' : 'html';
  parseText(data, parseTextLiteral, parseTextExpression, environment);
}

function parseHtmlComment(tag: string, data: string) {
  // Only output comments that start with `<!--[` and end with `]-->`
  if (!htmlUtil.isConditionalComment(tag)) return;
  const comment = new templates.Comment(data);
  parseNode.content.push(comment);
}

const doctypeRegExp = /^<!DOCTYPE\s+([^\s]+)(?:\s+(PUBLIC|SYSTEM)\s+"([^"]+)"(?:\s+"([^"]+)")?)?\s*>/i;

function parseHtmlOther(tag: string) {
  const match = doctypeRegExp.exec(tag);
  if (match) {
    const name = match[1];
    const idType = match[2] && match[2].toLowerCase();
    let publicId, systemId;
    if (idType === 'public') {
      publicId = match[3];
      systemId = match[4];
    } else if (idType === 'system') {
      systemId = match[3];
    }
    const doctype = new templates.Doctype(name, publicId, systemId);
    parseNode.content.push(doctype);
  } else {
    unexpected(tag);
  }
}

function parseTextLiteral(data: string) {
  const text = new templates.Text(data);
  parseNode.content.push(text);
}

function parseTextExpression(source: string, environment: string) {
  const expression = createExpression(source);
  if (expression.meta.blockType) {
    parseBlockExpression(expression);
  } else if (expression.meta.valueType === 'view') {
    parseViewExpression(expression);
  } else if (expression.meta.unescaped && environment === 'html') {
    const html = new templates.DynamicHtml(expression);
    parseNode.content.push(html);
  } else {
    const text = new templates.DynamicText(expression);
    parseNode.content.push(text);
  }
}

function parseBlockExpression(expression: Expression) {
  const blockType = expression.meta.blockType;

  // Block ending
  if (expression.meta.isEnd) {
    parseNode = parseNode.parent;
    // Validate that the block ending matches an appropriate block start
    const last = parseNode.last();
    const lastExpression = last && (last.expression || (last.expressions && last.expressions[0]));
    if (!(
      lastExpression &&
      (blockType === 'end' && lastExpression.meta.blockType) ||
      (blockType === lastExpression.meta.blockType)
    )) {
      throw new Error('Mismatched closing template tag: ' + expression.meta.source);
    }

    // Continuing block
  } else if (blockType === 'else' || blockType === 'else if') {
    parseNode = parseNode.parent;
    const last = parseNode.last();
    parseNode = parseNode.child();

    if (last instanceof templates.ConditionalBlock) {
      last.expressions.push(expression);
      last.contents.push(parseNode.content);
    } else if (last instanceof templates.EachBlock) {
      if (blockType !== 'else') unexpected(expression.meta.source);
      last.elseContent = parseNode.content;
    } else {
      unexpected(expression.meta.source);
    }

    // Block start
  } else {
    const nextNode = parseNode.child();
    let block;
    if (blockType === 'if' || blockType === 'unless') {
      block = new templates.ConditionalBlock([expression], [nextNode.content]);
    } else if (blockType === 'each') {
      block = new templates.EachBlock(expression, nextNode.content);
    } else {
      block = new templates.Block(expression, nextNode.content);
    }
    parseNode.content.push(block);
    parseNode = nextNode;
  }
}

function parseViewElement(element: any) {
  // TODO: "name" is deprecated in lieu of "is". Remove "name" in Derby 0.6.0
  const nameAttribute = element.attributes.is || element.attributes.name;
  if (!nameAttribute) {
    throw new Error('The <view> element requires an "is" attribute');
  }
  delete element.attributes.is;
  delete element.attributes.name;

  if (nameAttribute.expression) {
    const viewAttributes = viewAttributesFromElement(element);
    const componentHooks = componentHooksFromAttributes(viewAttributes);
    const remaining = element.content || [];
    const viewInstance = createDynamicViewInstance(nameAttribute.expression, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
    finishParseViewElement(viewAttributes, remaining, viewInstance);
  } else {
    const name = nameAttribute.data;
    const view = findView(name);
    parseNamedViewElement(element, view, name);
  }
}

function findView(name: string) {
  const view = parseNode.view.views.find(name, parseNode.view.namespace);
  if (!view) {
    const message = parseNode.view.views.findErrorMessage(name);
    throw new Error(message);
  }
  return view;
}

function parseNamedViewElement(element, view: View, _name: string) {
  const viewAttributes = viewAttributesFromElement(element);
  const componentHooks = componentHooksFromAttributes(viewAttributes);
  const remaining = parseContentAttributes(element.content, view, viewAttributes);
  const viewInstance = new templates.ViewInstance(view.registeredName, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  finishParseViewElement(viewAttributes, remaining, viewInstance);
}

function createDynamicViewInstance(expression: Expression, attributes: Record<string, string>, hooks: MarkupHook<unknown>[], initHooks: MarkupHook<unknown>[]) {
  const viewInstance = new templates.DynamicViewInstance(expression, attributes, hooks, initHooks);
  // Wrap the viewInstance in a block with the same expression, so that it is
  // re-rendered when any of its dependencies change
  return new templates.Block(expression, [viewInstance]);
}

function finishParseViewElement(viewAttributes, remaining, viewInstance) {
  setContentAttribute(viewAttributes, remaining);
  delete viewAttributes.within;
  parseNode.content.push(viewInstance);
}

function setContentAttribute(attributes, content) {
  if (Object.prototype.hasOwnProperty.call(attributes, ['content'])) return;
  if (!content.length) return;
  attributes.content = attributeValueFromContent(content, attributes.within);
}

function attributeValueFromContent(content, isWithin) {
  // Optimize common cases where content can be a literal or a single expression
  if (content.length === 1) {
    const item = content[0];
    if (item instanceof templates.Text) {
      return item.data;
    }
    if (item instanceof templates.DynamicText) {
      const expression = item.expression;
      if (expression instanceof expressions.LiteralExpression) {
        return expression.value;
      }
      // In the case of within attributes, always use a template, never an
      // expression. A within value depends on the rendering context, so we
      // cannot get a single value for the attribute and store it on the
      // component model when the component is initialized
      if (isWithin) return item;
      // Create an expression in cases where it is safe to do so. This allows
      // derby to get the intended value and store it on the component model
      return new expressions.ViewParentExpression(expression);
    }
  }
  // Otherwise, wrap a template as needed for the context
  const template = new templates.Template(content);
  return (isWithin) ? template : new templates.ViewParent(template);
}

function viewAttributesFromElement(element) {
  const viewAttributes = {};
  for (const key in element.attributes) {
    checkKeyIsSafe(key);
    const attribute = element.attributes[key];
    const camelCased = dashToCamelCase(key);
    viewAttributes[camelCased] =
      (attribute.expression instanceof templates.Template) ?
        new templates.ViewParent(attribute.expression) :
        (attribute.expression instanceof expressions.Expression) ?
          new expressions.ViewParentExpression(attribute.expression) :
          attribute.data;
  }
  return viewAttributes;
}

function parseAsAttribute(key, value) {
  const expression = createPathExpression(value);
  if (!(expression instanceof expressions.PathExpression)) {
    throw new Error(key + ' attribute must be a path: ' + key + '="' + value + '"');
  }
  return expression.segments;
}

function parseAsObjectAttribute(key, value) {
  let expression = createPathExpression(value);
  if (!(
    expression instanceof expressions.SequenceExpression &&
    expression.args.length === 2 &&
    expression.args[0] instanceof expressions.PathExpression
  )) {
    throw new Error(key + ' attribute requires a path and a key argument: ' + key + '="' + value + '"');
  }
  const segments = expression.args[0].segments;
  expression = expression.args[1];
  return { segments: segments, expression: expression };
}

function parseOnAttribute(key, value) {
  // TODO: Argument checking
  return createPathExpression(value);
}

function elementHooksFromAttributes(attributes, _type?) {
  if (!attributes) return;
  const hooks = [];

  for (const key in attributes) {
    const value = attributes[key];

    // Parse `as` assignments
    if (key === 'as') {
      const segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsProperty(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'as-array') {
      const segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsArray(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'as-object') {
      const parsed = parseAsObjectAttribute(key, value);
      hooks.push(new templates.AsObject(parsed.segments, parsed.expression));
      delete attributes[key];
      continue;
    }

    // Parse event listeners
    const match = /^on-(.+)/.exec(key);
    const eventName = match && match[1];
    if (eventName) {
      const expression = parseOnAttribute(key, value);
      hooks.push(new templates.ElementOn(eventName, expression));
      delete attributes[key];
    }
  }

  if (hooks.length) return hooks;
}

function componentHooksFromAttributes(attributes) {
  if (!attributes) return {};
  const hooks = [];
  const initHooks = [];

  for (const key in attributes) {
    const value = attributes[key];

    // Parse `as` assignments
    if (key === 'as') {
      const segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsPropertyComponent(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'asArray') {
      const segments = parseAsAttribute('as-array', value);
      hooks.push(new templates.AsArrayComponent(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'asObject') {
      const parsed = parseAsObjectAttribute('as-object', value);
      hooks.push(new templates.AsObjectComponent(parsed.segments, parsed.expression));
      delete attributes[key];
      continue;
    }

    // Parse event listeners
    const match = /^on([A-Z_].*)/.exec(key);
    const eventName = match && match[1].charAt(0).toLowerCase() + match[1].slice(1);
    if (eventName) {
      const expression = parseOnAttribute(key, value);
      initHooks.push(new templates.ComponentOn(eventName, expression));
      delete attributes[key];
    }
  }

  return {
    hooks: (hooks.length) ? hooks : null,
    initHooks: (initHooks.length) ? initHooks : null
  };
}

function dashToCamelCase(string) {
  return string.replace(/-./g, function(match) {
    return match.charAt(1).toUpperCase();
  });
}

function parseContentAttributes(content, view, viewAttributes) {
  const remaining = [];
  if (!content) return remaining;
  for (let i = 0, len = content.length; i < len; i++) {
    const item = content[i];
    let name = (item instanceof templates.Element) && item.tagName;

    if (name === 'attribute') {
      name = parseNameAttribute(item);
      parseAttributeElement(item, name, viewAttributes);

    } else if (view.attributesMap && view.attributesMap[name]) {
      parseAttributeElement(item, name, viewAttributes);

    } else if (name === 'array') {
      name = parseNameAttribute(item);
      parseArrayElement(item, name, viewAttributes);

    } else if (view.arraysMap && view.arraysMap[name]) {
      parseArrayElement(item, view.arraysMap[name], viewAttributes);

    } else {
      remaining.push(item);
    }
  }
  return remaining;
}

function parseNameAttribute(element) {
  // TODO: "name" is deprecated in lieu of "is". Remove "name" in Derby 0.6.0
  const nameAttribute = element.attributes.is || element.attributes.name;
  const name = nameAttribute.data;
  if (!name) {
    throw new Error('The <' + element.tagName + '> element requires a literal "is" attribute');
  }
  delete element.attributes.is;
  delete element.attributes.name;
  return name;
}

function parseAttributeElement(element, name, viewAttributes) {
  const camelName = dashToCamelCase(name);
  checkKeyIsSafe(camelName);
  const isWithin = element.attributes && element.attributes.within;
  viewAttributes[camelName] = attributeValueFromContent(element.content, isWithin);
}

function createAttributesExpression(attributes) {
  const dynamicAttributes = {};
  const literalAttributes = {};
  let isLiteral = true;
  for (const key in attributes) {
    checkKeyIsSafe(key);
    const attribute = attributes[key];
    if (attribute instanceof expressions.Expression) {
      dynamicAttributes[key] = attribute;
      isLiteral = false;
    } else if (attribute instanceof templates.Template) {
      dynamicAttributes[key] = new expressions.DeferRenderExpression(attribute);
      isLiteral = false;
    } else {
      dynamicAttributes[key] = new expressions.LiteralExpression(attribute);
      literalAttributes[key] = attribute;
    }
  }
  return (isLiteral) ?
    new expressions.LiteralExpression(literalAttributes) :
    new expressions.ObjectExpression(dynamicAttributes);
}

function parseArrayElement(element, name, viewAttributes) {
  const attributes = viewAttributesFromElement(element);
  setContentAttribute(attributes, element.content);
  // @ts-expect-error Attribute `within` does not exist on {}
  delete attributes.within;
  const expression = createAttributesExpression(attributes);
  const camelName = dashToCamelCase(name);
  checkKeyIsSafe(camelName);
  const viewAttribute = viewAttributes[camelName];

  // If viewAttribute is already an ArrayExpression, push the expression for
  // the current array element
  if (viewAttribute instanceof expressions.ArrayExpression) {
    viewAttribute.items.push(expression);

    // Alternatively, viewAttribute will be an array if its items have all been
    // literal values thus far
  } else if (Array.isArray(viewAttribute)) {
    if (expression instanceof expressions.LiteralExpression) {
      // If the current array element continues to be a literal value, push it
      // on the existing array
      viewAttribute.push(expression.value);
    } else {
      // However, if the array element produces a non-literal expression,
      // convert the values in the array into an equivalent ArrayExpression of
      // LiteralExpressions, then push on this expression as well
      const items = [];
      for (let i = 0; i < viewAttribute.length; i++) {
        items[i] = new expressions.LiteralExpression(viewAttribute[i]);
      }
      items.push(expression);
      viewAttributes[camelName] = new expressions.ArrayExpression(items);
    }

    // For the first array element encountered, create a containing array or
    // ArrayExpression. Create an array of raw values in the literal case and an
    // ArrayExpression of expressions in the non-literal case
  } else if (viewAttribute == null) {
    viewAttributes[camelName] = (expression instanceof expressions.LiteralExpression) ?
      [expression.value] : new expressions.ArrayExpression([expression]);

  } else {
    unexpected();
  }
}

function parseViewExpression(expression) {
  // If there are multiple arguments separated by commas, they will get parsed
  // as a SequenceExpression
  let nameExpression, attributesExpression;
  if (expression instanceof expressions.SequenceExpression) {
    nameExpression = expression.args[0];
    attributesExpression = expression.args[1];
  } else {
    nameExpression = expression;
  }

  const viewAttributes = viewAttributesFromExpression(attributesExpression);
  const componentHooks = componentHooksFromAttributes(viewAttributes);

  // A ViewInstance has a static name, and a DynamicViewInstance gets its name
  // at render time
  let viewInstance;
  if (nameExpression instanceof expressions.LiteralExpression) {
    const name = nameExpression.get();
    // Will throw if the view can't be found immediately
    findView(name);
    viewInstance = new templates.ViewInstance(name, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  } else {
    viewInstance = createDynamicViewInstance(nameExpression, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  }
  parseNode.content.push(viewInstance);
}

function viewAttributesFromExpression(expression) {
  if (!expression) return;
  const object = (expression instanceof expressions.ObjectExpression) ? expression.properties :
    (expression instanceof expressions.LiteralExpression) ? expression.value : null;
  if (typeof object !== 'object') unexpected();

  const viewAttributes = {};
  for (const key in object) {
    checkKeyIsSafe(key);
    const value = object[key];
    viewAttributes[key] =
      (value instanceof expressions.LiteralExpression) ? value.value :
        (value instanceof expressions.Expression) ? new expressions.ViewParentExpression(value) :
          value;
  }
  return viewAttributes;
}

class ParseNode {
  view: View;
  parent?: ParseNode;
  content: any[];
  namespaceUri?: string;

  constructor(view: View, parent?: ParseNode) {
    this.view = view;
    this.parent = parent;
    this.content = [];
    this.namespaceUri = parent && parent.namespaceUri;
  }

  child() {
    return new ParseNode(this.view, this);
  }

  last() {
    return this.content[this.content.length - 1];
  }
}

function escapeBraced(source: string) {
  let out = '';
  parseText(source, onLiteral, onExpression, 'string');
  function onLiteral(text) {
    out += text;
  }
  function onExpression(text) {
    const escaped = text.replace(/[&<]/g, function(match) {
      return (match === '&') ? '&amp;' : '&lt;';
    });
    out += '{{' + escaped + '}}';
  }
  return out;
}

function unescapeBraced(source: string) {
  return source.replace(/(?:&amp;|&lt;)/g, function(match) {
    return (match === '&amp;') ? '&' : '<';
  });
}

function unescapeTextLiteral(text: string, environment: string) {
  return (environment === 'html' || environment === 'attribute') ?
    htmlUtil.unescapeEntities(text) :
    text;
}

function parseText(data: string, onLiteral, onExpression, environment: string) {
  let current = data;
  let last;
  while (current) {
    if (current === last) throw new Error('Error parsing template text: ' + data);
    last = current;

    const start = current.indexOf('{{');
    if (start === -1) {
      const unescapedCurrent = unescapeTextLiteral(current, environment);
      onLiteral(unescapedCurrent);
      return;
    }

    const end = matchBraces(current, 2, start, '{', '}');
    if (end === -1) throw new Error('Mismatched braces in: ' + data);

    if (start > 0) {
      const before = current.slice(0, start);
      const unescapedBefore = unescapeTextLiteral(before, environment);
      onLiteral(unescapedBefore);
    }

    const inside = current.slice(start + 2, end - 2);
    if (inside) {
      let unescapedInside = unescapeBraced(inside);
      unescapedInside = unescapeTextLiteral(unescapedInside, environment);
      onExpression(unescapedInside, environment);
    }

    current = current.slice(end);
  }
}

function matchBraces(text, num, i, openChar, closeChar) {
  i += num;
  while (num) {
    const close = text.indexOf(closeChar, i);
    const open = text.indexOf(openChar, i);
    const hasClose = close !== -1;
    const hasOpen = open !== -1;
    if (hasClose && (!hasOpen || (close < open))) {
      i = close + 1;
      num--;
      continue;
    } else if (hasOpen) {
      i = open + 1;
      num++;
      continue;
    } else {
      return -1;
    }
  }
  return i;
}

const blockRegExp = /^(if|unless|else if|each|with|on)\s+([\s\S]+?)(?:\s+as\s+([^,\s]+)\s*(?:,\s*(\S+))?)?$/;
const valueRegExp = /^(?:(view|unbound|bound|unescaped)\s+)?([\s\S]*)/;

export function createExpression(source: string) {
  source = source.trim();
  const meta = new expressions.ExpressionMeta(source);

  // Parse block expression //

  // The block expressions `if`, `unless`, `else if`, `each`, `with`, and `on`
  // must have a single blockType keyword and a path. They may have an optional
  // alias assignment
  let match = blockRegExp.exec(source);
  let path, as, keyAs;
  if (match) {
    meta.blockType = match[1];
    path = match[2];
    as = match[3];
    keyAs = match[4];

    // The blocks `else`, `unbound`, and `bound` may not have a path or alias
  } else if (source === 'else' || source === 'unbound' || source === 'bound') {
    meta.blockType = source;

    // Any source that starts with a `/` is treated as an end block. Either a
    // `{{/}}` with no following characters or a `{{/if}}` style ending is valid
  } else if (source.charAt(0) === '/') {
    meta.isEnd = true;
    meta.blockType = source.slice(1).trim() || 'end';


    // Parse value expression //
    // A value expression has zero or many keywords and an expression
  } else {
    path = source;
    let keyword;
    do {
      match = valueRegExp.exec(path);
      keyword = match[1];
      path = match[2];
      if (keyword === 'unescaped') {
        meta.unescaped = true;
      } else if (keyword === 'unbound' || keyword === 'bound') {
        meta.bindType = keyword;
      } else if (keyword) {
        meta.valueType = keyword;
      }
    } while (keyword);
  }

  // Wrap parsing in a try / catch to add context to message when throwing
  let expression;
  try {
    expression = (path) ?
      createPathExpression(path) :
      new expressions.Expression();
    if (as) {
      meta.as = parseAlias(as);
    }
    if (keyAs) {
      meta.keyAs = parseAlias(keyAs);
    }
  } catch (err) {
    const message = '\n\nWithin expression: ' + source;
    throw appendErrorMessage(err, message);
  }
  expression.meta = meta;
  return expression;
}

function unexpected(source?: unknown) {
  throw new Error('Error parsing template: ' + JSON.stringify(source));
}

function appendErrorMessage(err: unknown, message: string) {
  if (err instanceof Error) {
    err.message += message;
    return err;
  }
  return new Error(err + message);
}

function parseAlias(source: string) {
  // Try parsing into a path expression. This throws on invalid expressions.
  const expression = createPathExpression(source);
  // Verify that it's an AliasPathExpression with no segments, i.e. that
  // it has the format "#IDENTIFIER".
  if (expression instanceof expressions.AliasPathExpression) {
    if (expression.segments.length === 0) {
      return expression.alias;
    }
    throw new Error('Alias must not have dots or brackets: ' + source);
  }
  throw new Error('Alias must be an identifier starting with "#": ' + source);
}

AppForClient.prototype.addViews = function(file: string, namespace: string) {
  const views = parseViews(file, namespace);
  registerParsedViews(this, views);
};

export function getImportNamespace(namespace: string, attrs: Record<string, string>, importFilename: string) {
  const extension = path.extname(importFilename);
  const relativeNamespace = (attrs.ns == null) ?
    path.basename(attrs.src, extension) :
    attrs.ns;
  return (namespace && relativeNamespace) ?
    namespace + ':' + relativeNamespace :
    namespace || relativeNamespace || '';
}

export function parseViews(file: string, namespace: string, filename?: string, onImport?: (attrs) => void) {
  const views: ParsedView[] = [];
  const prefix = (namespace) ? namespace + ':' : '';

  htmlUtil.parse(file + '\n', {
    // Force view tags to be treated as raw tags,
    // meaning their contents are not parsed as HTML
    rawTags: /^(?:[^\s=/!>]+:|style|script)$/i,
    matchEnd: matchEnd,
    start: onStart,
    text: onText
  });

  function matchEnd(tagName: string) {
    if (tagName.slice(-1) === ':') {
      return /<\/?[^\s=/!>]+:[\s>]/i;
    }
    return new RegExp('</' + tagName, 'i');
  }

  // These variables pass state from attributes in the start tag to the
  // following view template text
  let name, attrs;

  function onStart(tag, tagName, tagAttrs) {
    const lastChar = tagName.charAt(tagName.length - 1);
    if (lastChar !== ':') {
      throw new Error('Expected tag ending in colon (:) instead of ' + tag);
    }
    name = tagName.slice(0, -1);
    attrs = tagAttrs;
    if (name === 'import') {
      if (typeof onImport === 'function') {
        onImport(attrs);
      } else {
        throw new Error('Template import implementation not provided');
      }
    }
  }

  function onText(text, _isRawText) {
    if (!name || name === 'import') return;
    views.push({
      name: prefix + name,
      source: text,
      options: attrs,
      filename: filename
    });
  }

  return views;
}

export function registerParsedViews(app: App, items: ParsedView[]) {
  for (let i = 0, len = items.length; i < len; i++) {
    const item = items[i];
    app.views.register(item.name, item.source, item.options);
  }
}
