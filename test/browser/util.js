var expect = require('chai').expect;
var DerbyStandalone = require('../../lib/DerbyStandalone');
var derby = new DerbyStandalone();
require('derby-parsing');

exports.derby = derby;
exports.expectHtml = expectHtml;
exports.fragmentHtml = fragmentHtml;

function expectHtml(fragment, html) {
  expect(fragmentHtml(fragment)).equal(html);
}

function fragmentHtml(fragment) {
  var clone = document.importNode(fragment, true);
  // last two arguments for createTreeWalker are required in IE unfortunately
  var treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT, null, false);
  var toRemove = [];
  for (var node; node = treeWalker.nextNode();) {
    toRemove.push(node);
  }
  for (var i = toRemove.length; i--;) {
    toRemove[i].parentNode.removeChild(toRemove[i]);
  }
  var el = document.createElement('ins');
  el.appendChild(clone);
  return el.innerHTML;
}
