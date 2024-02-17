var domTestRunner = require('../../dist/test-utils/domTestRunner');

describe('domTestRunner', function() {
  describe('with JSDOM option pretendToBeVisual', function() {
    domTestRunner.install({jsdomOptions: {pretendToBeVisual: true}});
    it('has window.requestAnimationFrame', function(done) {
      window.requestAnimationFrame(function() {
        done();
      });
    });
  });
});
