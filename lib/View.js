var templates = require('./templates');

module.exports = Views;

function ViewsMap() {}
function Views() {
  this.map = new ViewsMap();
}
Views.prototype.find = function(name, at) {
  var map = this.map;

  // Exact match lookup
  if (map[name]) return finishFind(map, name);

  // Relative lookup
  at || (at = 'app');
  var segments = at.split(':');
  for (var i = segments.length; i; i--) {
    var prefix = segments.slice(0, i).join(':');
    var key = prefix + ':' + name;
    if (map[key]) return finishFind(map, key);
  }
};
Views.prototype.register = function(name, source) {
  this.map[name] = source;
};

function finishFind(map, key) {
  var match = map[key];
  if (typeof match === 'string') {
    var template = templates.createTemplate(match);
    map[key] = template;
    return template;
  }
  return match;
}
