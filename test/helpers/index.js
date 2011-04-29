var should = require('should');

exports.wrapTest = function(func, numCallbacks) {
  numCallbacks = (typeof numCallbacks === 'number') ? numCallbacks : 1;
  return function(beforeExit) {
    var n = 0;
    function done() { n++; }
    func(done);
    beforeExit(function() {
      n.should.equal(numCallbacks);
    });
  }
}