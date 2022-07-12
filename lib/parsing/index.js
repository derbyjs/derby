var htmlUtil = require('html-util');
var derbyTemplates = require('../templates');
var templates = derbyTemplates.templates;
var expressions = derbyTemplates.expressions;
var createPathExpression = require('./createPathExpression');
var markup = require('./markup');
var path = require('path');
var App = require('../App');

exports.createTemplate = createTemplate;
exports.createStringTemplate = createStringTemplate;
exports.createExpression = createExpression;
exports.createPathExpression = createPathExpression;
exports.markup = markup;

App.prototype.addViews = function(file, namespace) {
  var views = exports.parseViews(file, namespace);
  exports.registerParsedViews(this, views);
};

exports.getImportNamespace = function(namespace, attrs, importFilename) {
  var extension = path.extname(importFilename);
  var relativeNamespace = (attrs.ns == null) ?
    path.basename(attrs.src, extension) :
    attrs.ns;
  return (namespace && relativeNamespace) ?
    namespace + ':' + relativeNamespace :
    namespace || relativeNamespace || '';
};

exports.parseViews = function(file, namespace, filename, onImport) {
  var views = [];
  var prefix = (namespace) ? namespace + ':' : '';

  htmlUtil.parse(file + '\n', {
    // Force view tags to be treated as raw tags,
    // meaning their contents are not parsed as HTML
    rawTags: /^(?:[^\s=\/!>]+:|style|script)$/i,
    matchEnd: matchEnd,
    start: onStart,
    text: onText
  });

  function matchEnd(tagName) {
    if (tagName.slice(-1) === ':') {
      return /<\/?[^\s=\/!>]+:[\s>]/i;
    }
    return new RegExp('</' + tagName, 'i');
  }

  // These variables pass state from attributes in the start tag to the
  // following view template text
  var name, attrs;

  function onStart(tag, tagName, tagAttrs) {
    var lastChar = tagName.charAt(tagName.length - 1);
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

  function onText(text, isRawText) {
    if (!name || name === 'import') return;
    views.push({
      name: prefix + name,
      source: text,
      options: attrs,
      filename: filename
    });
  }

  return views;
};

exports.registerParsedViews = function(app, items) {
  for (var i = 0, len = items.length; i < len; i++) {
    var item = items[i];
    app.views.register(item.name, item.source, item.options);
  }
};

// View.prototype._parse is defined here, so that it doesn't have to
// be included in the client if templates are all parsed server-side
templates.View.prototype._parse = function() {
  // Wrap parsing in a try / catch to add context to message when throwing
  var template;
  try {
    if (this.literal) {
      var source = (this.unminified) ? this.source :
        // Remove leading and trailing whitespace only lines by default
        this.source.replace(/^\s*\n/, '').replace(/\s*$/, '');
      template = new templates.Text(source);
    } else if (this.string) {
      template = createStringTemplate(this.source, this);
    } else {
      var source = (this.unminified) ? this.source :
        htmlUtil.minify(this.source).replace(/&sp;/g, ' ');
      template = createTemplate(source, this);
    }
  } catch (err) {
    var message = '\n\nWithin template "' + this.name + '":\n' + this.source;
    throw appendErrorMessage(err, message);
  }
  this.template = template;
  return template;
};

// Modified and shared among the following parse functions. It's OK for this
// to be shared at the module level, since it is only used by synchronous code
var parseNode;

function createTemplate(source, view) {
  source = escapeBraced(source);
  parseNode = new ParseNode(view);
  htmlUtil.parse(source, {
    start: parseHtmlStart
  , end: parseHtmlEnd
  , text: parseHtmlText
  , comment: parseHtmlComment
  , other: parseHtmlOther
  });
  // Allow for certain elements at the end of a template to not be closed. This
  // is especially important so that </body> and </html> tags can be omitted,
  // since Derby sends an additional script tag after the HTML for the page
  while (parseNode.parent) {
    parseNode = parseNode.parent;
    var last = parseNode.last();
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

function createStringTemplate(source, view) {
  source = escapeBraced(source);
  parseNode = new ParseNode(view);
  parseText(source, parseTextLiteral, parseTextExpression, 'string');
  return new templates.Template(parseNode.content);
}

function parseHtmlStart(tag, tagName, attributes, selfClosing) {
  var lowerTagName = tagName.toLowerCase();
  var hooks;
  if (lowerTagName !== 'view' && !viewForTagName(lowerTagName)) {
    hooks = elementHooksFromAttributes(attributes);
  }
  var attributesMap = parseAttributes(attributes);
  var namespaceUri = (lowerTagName === 'svg') ?
    templates.NAMESPACE_URIS.svg : parseNode.namespaceUri;
  var Constructor = templates.Element;
  if (lowerTagName === 'tag') {
    Constructor = templates.DynamicElement;
    tagName = attributesMap.is;
    delete attributesMap.is;
  }
  if (selfClosing || templates.VOID_ELEMENTS[lowerTagName]) {
    var element = new Constructor(tagName, attributesMap, null, hooks, selfClosing, null, namespaceUri);
    parseNode.content.push(element);
    parseElementClose(lowerTagName);
  } else {
    parseNode = parseNode.child();
    parseNode.namespaceUri = namespaceUri;
    var element = new Constructor(tagName, attributesMap, parseNode.content, hooks, selfClosing, null, namespaceUri);
    parseNode.parent.content.push(element);
  }
}

function parseAttributes(attributes) {
  var attributesMap;
  for (var key in attributes) {
    if (!attributesMap) attributesMap = {};

    var value = attributes[key];
    var match = /([^:]+):[^:]/.exec(key);
    var nsUri = match && templates.NAMESPACE_URIS[match[1]];
    if (value === '' || typeof value !== 'string') {
      attributesMap[key] = new templates.Attribute(value, nsUri);
      continue;
    }

    parseNode = parseNode.child();
    parseText(value, parseTextLiteral, parseTextExpression, 'attribute');

    if (parseNode.content.length === 1) {
      var item = parseNode.content[0];
      attributesMap[key] =
        (item instanceof templates.Text) ? new templates.Attribute(item.data, nsUri) :
        (item instanceof templates.DynamicText) ?
          (item.expression instanceof expressions.LiteralExpression) ?
            new templates.Attribute(item.expression.value, nsUri) :
            new templates.DynamicAttribute(item.expression, nsUri) :
          new templates.DynamicAttribute(item, nsUri);

    } else if (parseNode.content.length > 1) {
      var template = new templates.Template(parseNode.content, value);
      attributesMap[key] = new templates.DynamicAttribute(template, nsUri);

    } else {
      throw new Error('Error parsing ' + key + ' attribute: ' + value);
    }

    parseNode = parseNode.parent;
  }
  return attributesMap;
}

function parseHtmlEnd(tag, tagName) {
  parseNode = parseNode.parent;
  var last = parseNode.last();
  if (!(
    (last instanceof templates.DynamicElement && tagName.toLowerCase() === 'tag') ||
    (last instanceof templates.Element && last.tagName === tagName)
  )) {
    throw new Error('Mismatched closing HTML tag: ' + tag);
  }
  parseElementClose(tagName);
}

function parseElementClose(tagName) {
  if (tagName === 'view') {
    var element = parseNode.content.pop();
    parseViewElement(element);
    return;
  }
  var view = viewForTagName(tagName);
  if (view) {
    var element = parseNode.content.pop();
    parseNamedViewElement(element, view, view.name);
    return;
  }
  var element = parseNode.last();
  markup.emit('element', element);
  markup.emit('element:' + tagName, element);
}

function viewForTagName(tagName) {
  return parseNode.view && parseNode.view.views.tagMap[tagName];
}

function parseHtmlText(data, isRawText) {
  var environment = (isRawText) ? 'string' : 'html';
  parseText(data, parseTextLiteral, parseTextExpression, environment);
}

function parseHtmlComment(tag, data) {
  // Only output comments that start with `<!--[` and end with `]-->`
  if (!htmlUtil.isConditionalComment(tag)) return;
  var comment = new templates.Comment(data);
  parseNode.content.push(comment);
}

var doctypeRegExp = /^<!DOCTYPE\s+([^\s]+)(?:\s+(PUBLIC|SYSTEM)\s+"([^"]+)"(?:\s+"([^"]+)")?)?\s*>/i;

function parseHtmlOther(tag) {
  var match = doctypeRegExp.exec(tag);
  if (match) {
    var name = match[1];
    var idType = match[2] && match[2].toLowerCase();
    var publicId, systemId;
    if (idType === 'public') {
      publicId = match[3];
      systemId = match[4];
    } else if (idType === 'system') {
      systemId = match[3];
    }
    var doctype = new templates.Doctype(name, publicId, systemId);
    parseNode.content.push(doctype);
  } else {
    unexpected(tag);
  }
}

function parseTextLiteral(data) {
  var text = new templates.Text(data);
  parseNode.content.push(text);
}

function parseTextExpression(source, environment) {
  var expression = createExpression(source);
  if (expression.meta.blockType) {
    parseBlockExpression(expression);
  } else if (expression.meta.valueType === 'view') {
    parseViewExpression(expression);
  } else if (expression.meta.unescaped && environment === 'html') {
    var html = new templates.DynamicHtml(expression);
    parseNode.content.push(html);
  } else {
    var text = new templates.DynamicText(expression);
    parseNode.content.push(text);
  }
}

function parseBlockExpression(expression) {
  var blockType = expression.meta.blockType;

  // Block ending
  if (expression.meta.isEnd) {
    parseNode = parseNode.parent;
    // Validate that the block ending matches an appropriate block start
    var last = parseNode.last();
    var lastExpression = last && (last.expression || (last.expressions && last.expressions[0]));
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
    var last = parseNode.last();
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
    var nextNode = parseNode.child();
    var block;
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

function parseViewElement(element) {
  // TODO: "name" is deprecated in lieu of "is". Remove "name" in Derby 0.6.0
  var nameAttribute = element.attributes.is || element.attributes.name;
  if (!nameAttribute) {
    throw new Error('The <view> element requires an "is" attribute');
  }
  delete element.attributes.is;
  delete element.attributes.name;

  if (nameAttribute.expression) {
    var viewAttributes = viewAttributesFromElement(element);
    var componentHooks = componentHooksFromAttributes(viewAttributes);
    var remaining = element.content || [];
    var viewInstance = createDynamicViewInstance(nameAttribute.expression, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
    finishParseViewElement(viewAttributes, remaining, viewInstance);
  } else {
    var name = nameAttribute.data;
    var view = findView(name);
    parseNamedViewElement(element, view, name);
  }
}

function findView(name) {
  var view = parseNode.view.views.find(name, parseNode.view.namespace);
  if (!view) {
    var message = parseNode.view.views.findErrorMessage(name);
    throw new Error(message);
  }
  return view;
}

function parseNamedViewElement(element, view, name) {
  var viewAttributes = viewAttributesFromElement(element);
  var componentHooks = componentHooksFromAttributes(viewAttributes);
  var remaining = parseContentAttributes(element.content, view, viewAttributes);
  var viewInstance = new templates.ViewInstance(view.registeredName, viewAttributes, componentHooks.hooks, componentHooks.initHooks);
  finishParseViewElement(viewAttributes, remaining, viewInstance);
}

function createDynamicViewInstance(expression, attributes, hooks, initHooks) {
  var viewInstance = new templates.DynamicViewInstance(expression, attributes, hooks, initHooks);
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
  if (attributes.hasOwnProperty('content')) return;
  if (!content.length) return;
  attributes.content = attributeValueFromContent(content, attributes.within);
}

function attributeValueFromContent(content, isWithin) {
  // Optimize common cases where content can be a literal or a single expression
  if (content.length === 1) {
    var item = content[0];
    if (item instanceof templates.Text) {
      return item.data;
    }
    if (item instanceof templates.DynamicText) {
      var expression = item.expression;
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
  var template = new templates.Template(content);
  return (isWithin) ? template : new templates.ViewParent(template);
}

function viewAttributesFromElement(element) {
  var viewAttributes = {};
  for (var key in element.attributes) {
    var attribute = element.attributes[key];
    var camelCased = dashToCamelCase(key);
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
  var expression = createPathExpression(value);
  if (!(expression instanceof expressions.PathExpression)) {
    throw new Error(key + ' attribute must be a path: ' + key + '="' + value + '"');
  }
  return expression.segments;
}

function parseAsObjectAttribute(key, value) {
  var expression = createPathExpression(value);
  if (!(
    expression instanceof expressions.SequenceExpression &&
    expression.args.length === 2 &&
    expression.args[0] instanceof expressions.PathExpression
  )) {
    throw new Error(key + ' attribute requires a path and a key argument: ' + key + '="' + value + '"');
  }
  var segments = expression.args[0].segments;
  var expression = expression.args[1];
  return {segments: segments, expression: expression};
}

function parseOnAttribute(key, value) {
  // TODO: Argument checking
  return createPathExpression(value);
}

function elementHooksFromAttributes(attributes, type) {
  if (!attributes) return;
  var hooks = [];

  for (var key in attributes) {
    var value = attributes[key];

    // Parse `as` assignments
    if (key === 'as') {
      var segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsProperty(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'as-array') {
      var segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsArray(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'as-object') {
      var parsed = parseAsObjectAttribute(key, value);
      hooks.push(new templates.AsObject(parsed.segments, parsed.expression));
      delete attributes[key];
      continue;
    }

    // Parse event listeners
    var match = /^on-(.+)/.exec(key);
    var eventName = match && match[1];
    if (eventName) {
      var expression = parseOnAttribute(key, value);
      hooks.push(new templates.ElementOn(eventName, expression));
      delete attributes[key];
    }
  }

  if (hooks.length) return hooks;
}

function componentHooksFromAttributes(attributes) {
  if (!attributes) return {};
  var hooks = [];
  var initHooks = [];

  for (var key in attributes) {
    var value = attributes[key];

    // Parse `as` assignments
    if (key === 'as') {
      var segments = parseAsAttribute(key, value);
      hooks.push(new templates.AsProperty(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'asArray') {
      var segments = parseAsAttribute('as-array', value);
      hooks.push(new templates.AsArrayComponent(segments));
      delete attributes[key];
      continue;
    }
    if (key === 'asObject') {
      var parsed = parseAsObjectAttribute('as-object', value);
      hooks.push(new templates.AsObjectComponent(parsed.segments, parsed.expression));
      delete attributes[key];
      continue;
    }

    // Parse event listeners
    var match = /^on([A-Z_].*)/.exec(key);
    var eventName = match && match[1].charAt(0).toLowerCase() + match[1].slice(1);
    if (eventName) {
      var expression = parseOnAttribute(key, value);
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
  var remaining = [];
  if (!content) return remaining;
  for (var i = 0, len = content.length; i < len; i++) {
    var item = content[i];
    var name = (item instanceof templates.Element) && item.tagName;

    if (name === 'attribute') {
      var name = parseNameAttribute(item);
      parseAttributeElement(item, name, viewAttributes);

    } else if (view.attributesMap && view.attributesMap[name]) {
      parseAttributeElement(item, name, viewAttributes);

    } else if (name === 'array') {
      var name = parseNameAttribute(item);
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
  var nameAttribute = element.attributes.is || element.attributes.name;
  var name = nameAttribute.data;
  if (!name) {
    throw new Error('The <' + element.tagName + '> element requires a literal "is" attribute');
  }
  delete element.attributes.is;
  delete element.attributes.name;
  return name;
}

function parseAttributeElement(element, name, viewAttributes) {
  var camelName = dashToCamelCase(name);
  var isWithin = element.attributes && element.attributes.within;
  viewAttributes[camelName] = attributeValueFromContent(element.content, isWithin);
}

function createAttributesExpression(attributes) {
  var dynamicAttributes = {};
  var literalAttributes = {};
  var isLiteral = true;
  for (var key in attributes) {
    var attribute = attributes[key];
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
  var attributes = viewAttributesFromElement(element);
  setContentAttribute(attributes, element.content);
  delete attributes.within;
  var expression = createAttributesExpression(attributes);
  var camelName = dashToCamelCase(name);
  var viewAttribute = viewAttributes[camelName];

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
      var items = [];
      for (var i = 0; i < viewAttribute.length; i++) {
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
  var nameExpression, attributesExpression;
  if (expression instanceof expressions.SequenceExpression) {
    nameExpression = expression.args[0];
    attributesExpression = expression.args[1];
  } else {
    nameExpression = expression;
  }

  var viewAttributes = viewAttributesFromExpression(attributesExpression);
  var componentHooks = componentHooksFromAttributes(viewAttributes);

  // A ViewInstance has a static name, and a DynamicViewInstance gets its name
  // at render time
  var viewInstance;
  if (nameExpression instanceof expressions.LiteralExpression) {
    var name = nameExpression.get();
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
  var object = (expression instanceof expressions.ObjectExpression) ? expression.properties :
    (expression instanceof expressions.LiteralExpression) ? expression.value : null;
  if (typeof object !== 'object') unexpected();

  var viewAttributes = {};
  for (var key in object) {
    var value = object[key];
    viewAttributes[key] =
      (value instanceof expressions.LiteralExpression) ? value.value :
      (value instanceof expressions.Expression) ?
        new expressions.ViewParentExpression(value) :
      value;
  }
  return viewAttributes;
}

function ParseNode(view, parent) {
  this.view = view;
  this.parent = parent;
  this.content = [];
  this.namespaceUri = parent && parent.namespaceUri;
}
ParseNode.prototype.child = function() {
  return new ParseNode(this.view, this);
};
ParseNode.prototype.last = function() {
  return this.content[this.content.length - 1];
};

function escapeBraced(source) {
  var out = '';
  parseText(source, onLiteral, onExpression, 'string');
  function onLiteral(text) {
    out += text;
  }
  function onExpression(text) {
    var escaped = text.replace(/[&<]/g, function(match) {
      return (match === '&') ? '&amp;' : '&lt;';
    });
    out += '{{' + escaped + '}}';
  }
  return out;
}

function unescapeBraced(source) {
  return source.replace(/(?:&amp;|&lt;)/g, function(match) {
    return (match === '&amp;') ? '&' : '<';
  });
}

function unescapeTextLiteral(text, environment) {
  return (environment === 'html' || environment === 'attribute') ?
    htmlUtil.unescapeEntities(text) :
    text;
}

function parseText(data, onLiteral, onExpression, environment) {
  var current = data;
  var last;
  while (current) {
    if (current === last) throw new Error('Error parsing template text: ' + data);
    last = current;

    var start = current.indexOf('{{');
    if (start === -1) {
      var unescapedCurrent = unescapeTextLiteral(current, environment);
      onLiteral(unescapedCurrent);
      return;
    }

    var end = matchBraces(current, 2, start, '{', '}');
    if (end === -1) throw new Error('Mismatched braces in: ' + data);

    if (start > 0) {
      var before = current.slice(0, start);
      var unescapedBefore = unescapeTextLiteral(before, environment);
      onLiteral(unescapedBefore);
    }

    var inside = current.slice(start + 2, end - 2);
    if (inside) {
      var unescapedInside = unescapeBraced(inside);
      unescapedInside = unescapeTextLiteral(unescapedInside, environment);
      onExpression(unescapedInside, environment);
    }

    current = current.slice(end);
  }
}

function matchBraces(text, num, i, openChar, closeChar) {
  i += num;
  while (num) {
    var close = text.indexOf(closeChar, i);
    var open = text.indexOf(openChar, i);
    var hasClose = close !== -1;
    var hasOpen = open !== -1;
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

var blockRegExp = /^(if|unless|else if|each|with|on)\s+([\s\S]+?)(?:\s+as\s+([^,\s]+)\s*(?:,\s*(\S+))?)?$/;
var valueRegExp = /^(?:(view|unbound|bound|unescaped)\s+)?([\s\S]*)/;

function createExpression(source) {
  source = source.trim();
  var meta = new expressions.ExpressionMeta(source);

  // Parse block expression //

  // The block expressions `if`, `unless`, `else if`, `each`, `with`, and `on`
  // must have a single blockType keyword and a path. They may have an optional
  // alias assignment
  var match = blockRegExp.exec(source);
  var path, as, keyAs;
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
    var keyword;
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
  var expression;
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
    var message = '\n\nWithin expression: ' + source;
    throw appendErrorMessage(err, message);
  }
  expression.meta = meta;
  return expression;
}

function unexpected(source) {
  throw new Error('Error parsing template: ' + source);
}

function appendErrorMessage(err, message) {
  if (err instanceof Error) {
    err.message += message;
    return err;
  }
  return new Error(err + message);
}

function parseAlias(source) {
  // Try parsing into a path expression. This throws on invalid expressions.
  var expression = createPathExpression(source);
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
