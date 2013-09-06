var testUtil = require('racer/test/util');
var expect = testUtil.expect;
var defaultFns = require('../lib/defaultFns');
var expressions = require('../lib/expressions');
var templates = require('../lib/templates');

var data = {
  _page: {
  }
};
var objectModel = new expressions.ObjectModel(data);
var contextMeta = new expressions.ContextMeta({fns: defaultFns});
var context = new expressions.Context(contextMeta, objectModel);

describe('Parse and render literal HTML', function() {

  var literalTests = {
    'empty string': ''
  , 'empty div': '<div></div>'
  , 'nested divs': '<div><div></div></div>'
  , 'sibling divs': '<div></div><div></div>'
  }

  for (var name in literalTests) {
    test(name, literalTests[name]);
  }
  function test(name, source) {
    it(name, function() {
      var source = literalTests[name];
      var template = templates.createTemplate(source);
      expect(template.get()).equal(source);
    });
  }
});

