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
  // Array and object literals
, '$array': {
    get: function() {
      return Array.prototype.slice.call(arguments);
    }
  }
, '$object': {
    get: function() {
      var value = {};
      for (var i = 0, len = arguments.length; i < len; i += 2) {
        var key = arguments[i];
        value[key] = arguments[i + 1];
      }
      return value;
    }
  }
};
