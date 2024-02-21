var expect = require('chai').expect;
var ComponentHarness = require('../../src/test-utils').ComponentHarness;

describe('ComponentHarness', function() {
  describe('file loading', function() {
    it('loads a component view from file', function() {
      var SimpleBox = require('../fixtures/simple-box');
      var html = new ComponentHarness('<view is="simple-box" />', SimpleBox).renderHtml().html;
      expect(html).equal('<div class="simple-box"></div>');
    });
  });
});
