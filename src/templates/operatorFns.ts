// `-` and `+` can be either unary or binary, so all unary operators are
// postfixed with `U` to differentiate

export const get = {
  // Unary operators
  '!U': function(value) {
    return !value;
  },
  '-U': function(value) {
    return -value;
  },
  '+U': function(value) {
    return +value;
  },
  '~U': function(value) {
    return ~value;
  },
  'typeofU': function(value) {
    return typeof value;
  },
  // Binary operators
  '||': function(left, right) {
    return left || right;
  },
  '&&': function(left, right) {
    return left && right;
  },
  '|': function(left, right) {
    return left | right;
  },
  '^': function(left, right) {
    return left ^ right;
  },
  '&': function(left, right) {
    return left & right;
  },
  '==': function(left, right) {
    // Template `==` intentionally uses same behavior as JS
    // eslint-disable-next-line eqeqeq
    return left == right;
  },
  '!=': function(left, right) {
    // Template `!=` intentionally uses same behavior as JS
    // eslint-disable-next-line eqeqeq
    return left != right;
  },
  '===': function(left, right) {
    return left === right;
  },
  '!==': function(left, right) {
    return left !== right;
  },
  '<': function(left, right) {
    return left < right;
  },
  '>': function(left, right) {
    return left > right;
  },
  '<=': function(left, right) {
    return left <= right;
  },
  '>=': function(left, right) {
    return left >= right;
  },
  'instanceof': function(left, right) {
    return left instanceof right;
  },
  'in': function(left, right) {
    return left in right;
  },
  '<<': function(left, right) {
    return left << right;
  },
  '>>': function(left, right) {
    return left >> right;
  },
  '>>>': function(left, right) {
    return left >>> right;
  },
  '+': function(left, right) {
    return left + right;
  },
  '-': function(left, right) {
    return left - right;
  },
  '*': function(left, right) {
    return left * right;
  },
  '/': function(left, right) {
    return left / right;
  },
  '%': function(left, right) {
    return left % right;
  },
  // Conditional operator
  '?': function(test, consequent, alternate) {
    return (test) ? consequent : alternate;
  },
  // Sequence
  ',': function(...args) {
    return args[args.length - 1];
  }
};

export const set = {
  // Unary operators
  '!U': function(value) {
    return [!value];
  },
  '-U': function(value) {
    return [-value];
  },
  // Binary operators
  '==': function(value, left, right) {
    if (value) return [right];
  },
  '===': function(value, left, right) {
    if (value) return [right];
  },
  'in': function(value, left, right) {
    right[left] = true;
    return {1: right};
  },
  '+': function(value, left, right) {
    return [value - right];
  },
  '-': function(value, left, right) {
    return [value + right];
  },
  '*': function(value, left, right) {
    return [value / right];
  },
  '/': function(value, left, right) {
    return [value * right];
  }
};
