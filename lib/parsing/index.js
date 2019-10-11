// TODO: Refactor and include derby-parsing module in derby itself
exports = module.exports = require('derby-parsing');
var htmlUtil = require('html-util');
var path = require('path');

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
