var templates = require('./templates');

module.exports = Views;

function ViewsMap() {}
function ViewFns() {}
function Views() {
  this.nameMap = new ViewsMap();
  this.elementMap = new ViewsMap();
  this.fns = new ViewFns();
}
Views.prototype.find = function(name, at) {
  var map = this.nameMap;

  // Exact match lookup
  var match = map[name];
  if (match) return match;

  // Relative lookup
  at || (at = ['app']);
  for (var i = at.length; i; i--) {
    var prefix = at.slice(0, i).join(':');
    match = map[prefix + ':' + name];
    if (match) return match;
  }
};
Views.prototype.register = function(name, source, options) {
  var view = new templates.View(this, name, source, options);
  if (name) this.nameMap[name] = view;
  if (options && options.element) this.elementMap[options.element] = view;
};
Views.prototype.fn = function(name, get, set) {
  var fn = (typeof get === 'function') ? new ViewFn(get, set) : get;
  this.fns[name] = fn;
};

function ViewFn(get, set) {
  this.get = get;
  this.set = set;
}
