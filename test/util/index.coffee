# For Mocha
exports.calls = (num, fn) ->
  (done) ->
    done() if num == n = 0
    fn -> done() if ++n >= num
