var templates = require('./templates');

module.exports = Views;

function ViewsMap() {}
function Views() {
  this.map = new ViewsMap();
}
Views.prototype.find = function(name, at) {
  var map = this.map;

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
  this.map[name] = new templates.View(this, name, source, options);
};
