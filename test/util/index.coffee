expect = require 'expect.js'

# For Mocha
exports.calls = (num, fn) ->
  (done) ->
    done() if num == n = 0
    fn -> done() if ++n >= num

expect.Assertion::NaN = ->
  @assert @obj != @obj,
    'expected ' + inspect(@obj) + ' to be NaN',
    'expected ' + inspect(@obj) + ' to not be NaN'
  return

expect.Assertion::null = ->
  @assert `this.obj == null`,
    'expected ' + inspect(@obj) + ' to be null or undefined',
    'expected ' + inspect(@obj) + ' to not be null or undefined'
  return
