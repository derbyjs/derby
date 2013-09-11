var templates = require('./templates');

module.exports = View;

function TemplatesMap() {}
function View() {
  this.templatesMap = new TemplatesMap();
}
View.prototype.find = function(name, at) {
  at || (at = 'app');
  var segments = at.split(':');
  var map = this.templatesMap;

  // Lookup relative to a template name
  for (var i = segments.length; i; i--) {
    var prefix = segments.slice(0, i).join(':');
    var ending = prefix + name;

    // Find an exact match
    var match = map[ending];
    if (match) return finishFind(map, ending, match);

    // Find a match at the end of a key
    var endingLen = ending.length;
    for (var key in map) {
      if (key.slice(key.length - endingLen) === ending) {
        match = map[key];
        if (match) return finishFind(map, key, match);
      }
    }
  }
};
View.prototype.register = function(name, source) {
  this.templatesMap[name] = source;
};

function finishFind(map, key, match) {
  if (typeof match === 'string') {
    var template = templates.createTemplate(match);
    map[key] = template;
    return template;
  }
  return match;
}
