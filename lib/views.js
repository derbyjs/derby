var parsing = require('./parsing');

module.exports = {
  Views: Views
, View: View
};

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
  at || (at = 'app');
  var segments = at.split(':');
  for (var i = segments.length; i; i--) {
    var prefix = segments.slice(0, i).join(':');
    match = map[prefix + ':' + name];
    if (match) return match;
  }
};
Views.prototype.register = function(name, source) {
  this.map[name] = new View(name, source);
};

function View(name, source) {
  this.name = name;
  this.source = source;
  var segments = this.name.split(':');
  this.at = segments.slice(0, segments.length - 1);
  this.template = null;
}
View.prototype.getTemplate = function() {
  return this.template ||
    (this.template = parsing.createTemplate(this.source));
}
