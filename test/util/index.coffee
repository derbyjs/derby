should = require 'should'

exports.wrapTest = (fn, numCallbacks = 1) ->
  (beforeExit) ->
    n = 0
    fn -> n++
    beforeExit ->
      n.should.equal numCallbacks
