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
};
