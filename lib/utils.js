// Based on Underscore.js:

var isArray = exports.isArray = Array.isArray || function(obj) {
  return toString.call(obj) === '[object Array]';
};
var isArguments = exports.isArguments = function(obj) {
  return !!(obj && hasOwnProperty.call(obj, 'callee'));
};
exports.isFunction = function(obj) {
  return !!(obj && obj.constructor && obj.call && obj.apply);
};
exports.isString = function(obj) {
  return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
};
exports.isNumber = function(obj) {
  return !!(obj === 0 || (obj && obj.toExponential && obj.toFixed));
};
// NaN happens to be the only value in JavaScript that does not equal itself.
exports.isNaN = function(obj) {
  return obj !== obj;
};
exports.isBoolean = function(obj) {
  return obj === true || obj === false;
};
exports.isDate = function(obj) {
  return !!(obj && obj.getTimezoneOffset && obj.setUTCFullYear);
};
exports.isRegExp = function(obj) {
  return !!(obj && obj.test && obj.exec && (obj.ignoreCase || obj.ignoreCase === false));
};
exports.isNull = function(obj) {
  return obj === null;
};
exports.isUndefined = function(obj) {
  return obj === void 0;
};
exports.isDefined = function(obj) {
  return obj !== void 0;
};
// Safely convert anything iterable into a real, live array.
exports.toArray = function(iterable) {
  if (!iterable) return [];
  if (iterable.toArray) return iterable.toArray();
  if (isArguments(iterable)) return Array.slice.call(iterable);
  if (isArray(iterable)) return iterable;
  return forEach(iterable, function(key, value) { return value; });
};

// Custom utils:

exports.toInteger = function(obj) {
  return obj - 0;
};

exports.onServer = typeof window === 'undefined';

var forEach = exports.forEach = function(obj, iterator) {
  for (var key in obj) {
    iterator(key, obj[key]);
  }
}

var _ = exports;
if (_.onServer) {
  exports.minify = (function() {
    var store = {},
        uglify = require('uglify-js')
    
    return function(js, cache) {
      if (cache && store[js]) return store[js];
      
      // This helps uglify to remove server only code
      js = js.replace(/_\.onServer/g, 'false');
      
      var ufuncs = uglify.uglify,
          out = uglify.parser.parse(js);
      out = ufuncs.ast_mangle(out);
      out = ufuncs.ast_squeeze(out);
      out = ufuncs.gen_code(out);
      if (cache) store[js] = out;
      return out;
    };
  })();
} else { } // Work around for uglify. See: https://github.com/mishoo/UglifyJS/issues/127