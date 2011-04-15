// Modified from HTML Parser By John Resig (ejohn.org)
// http://ejohn.org/blog/pure-javascript-html-parser/
// Original code by Erik Arvidsson, Mozilla Public License
// http://erik.eae.net/simplehtmlparser/simplehtmlparser.js

    // Regular Expressions for parsing
var startTag = /^<(\w+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
    endTag = /^<\/(\w+)[^>]*>/,
    attr = /(\w+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g,
    // Attributes that have their values filled in (Ex: disabled="disabled")
    fillAttrs = makeMap('checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected');

function makeMap(list) {
  return list.split(',').reduce(function(memo, item) {
    memo[item] = true;
    return memo;
  }, {});
}

var parse = exports.parse = function(html, handler) {
  var empty = function() {},
      charsHandler = (handler && handler.chars) || empty,
      startHandler = (handler && handler.start) || empty,
      endHandler = (handler && handler.end) || empty,
      last, index, chars, match;
  
  function parseStartTag(tag, tagName, rest) {
    var attrs = {};
    rest.replace(attr, function(match, name) {
      var value = arguments[2] ? arguments[2] :
        arguments[3] ? arguments[3] :
        arguments[4] ? arguments[4] :
        fillAttrs[name] ? name : '';
      attrs[name] = value;
    });
    startHandler(tagName, attrs);
  }

  function parseEndTag(tag, tagName) {
    endHandler(tagName);
  }
  
  // Remove all comments
  html = html.replace(/<!--[\s\S]*?-->(?:\n *)?/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?]]>(?:\n *)?/g, '');
  
  while (html) {
    last = html;
    chars = true;
      
    // End tag
    if (html[0] === '<' && html[1] === '/') {
      match = html.match(endTag);
      if (match) {
        html = html.substring(match[0].length);
        match[0].replace(endTag, parseEndTag);
        chars = false;
      }

    // Start tag
    } else if (html[0] === '<') {
      match = html.match(startTag);
      if (match) {
        html = html.substring(match[0].length);
        match[0].replace(startTag, parseStartTag);
        chars = false;
      }
    }

    if (chars) {
      index = html.indexOf('<');
      var text = index < 0 ? html : html.substring(0, index);
      html = index < 0 ? '' : html.substring(index);
      charsHandler(text);
    }

    if (html === last) {
      throw 'Parse Error: ' + html;
    }
  }
};