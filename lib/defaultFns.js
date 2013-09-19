util = require('util');

module.exports = {
  // Unary operators
  '!': {
    get: function(value) {
      return !value;
    }
  }
, '-': {
    get: function(value) {
      return -value;
    }
  }
, '+': {
    get: function(value) {
      return +value;
    }
  }
, '~': {
    get: function(value) {
      return ~value;
    }
  }
, 'typeof': {
    get: function(value) {
      return typeof value;
    }
  }
  // Binary operators
, '||': {
    get: function(left, right) {
      return left || right;
    }
  }
, '&&': {
    get: function(left, right) {
      return left && right;
    }
  }
, '|': {
    get: function(left, right) {
      return left | right;
    }
  }
, '^': {
    get: function(left, right) {
      return left ^ right;
    }
  }
, '&': {
    get: function(left, right) {
      return left & right;
    }
  }
, '==': {
    get: function(left, right) {
      return left == right;
    }
  }
, '!=': {
    get: function(left, right) {
      return left != right;
    }
  }
, '===': {
    get: function(left, right) {
      return left === right;
    }
  }
, '!==': {
    get: function(left, right) {
      return left !== right;
    }
  }
, '<': {
    get: function(left, right) {
      return left < right;
    }
  }
, '>': {
    get: function(left, right) {
      return left > right;
    }
  }
, '<=': {
    get: function(left, right) {
      return left <= right;
    }
  }
, '>=': {
    get: function(left, right) {
      return left >= right;
    }
  }
, 'instanceof': {
    get: function(left, right) {
      return left instanceof right;
    }
  }
, 'in': {
    get: function(left, right) {
      return left in right;
    }
  }
, '<<': {
    get: function(left, right) {
      return left << right;
    }
  }
, '>>': {
    get: function(left, right) {
      return left >> right;
    }
  }
, '>>>': {
    get: function(left, right) {
      return left >>> right;
    }
  }
, '+': {
    get: function(left, right) {
      return left + right;
    }
  }
, '-': {
    get: function(left, right) {
      return left - right;
    }
  }
, '*': {
    get: function(left, right) {
      return left * right;
    }
  }
, '/': {
    get: function(left, right) {
      return left / right;
    }
  }
, '%': {
    get: function(left, right) {
      return left % right;
    }
  }
  // Conditional operator
, '?': {
    get: function(test, consequent, alternate) {
      return (test) ? consequent : alternate;
    }
  }
, // Sequence
  ',': {
    get: function() {
      return arguments[arguments.length - 1];
    }
  }
  // Array literal
, '[]': {
    get: function() {
      return Array.prototype.slice.call(arguments);
    }
  }
  // Object literal
, '{}': {
    get: function() {
      var value = {};
      for (var i = 0, len = arguments.length; i < len; i += 2) {
        var key = arguments[i];
        value[key] = arguments[i + 1];
      }
      return value;
    }
  }
  // Utility functions
, 'log': {
    get: function() {
      var args = Array.prototype.slice.call(arguments);
      console.log.apply(console, args);
    }
  }
, 'inspect': {
    get: function(object, options) {
      return util.inspect(object, options);
    }
  }
};
