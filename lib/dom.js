var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher'),
    getMethods = {
      attr: function(el, attr) {
        return el.getAttribute(attr);
      },
      prop: function(el, prop) {
        return el[prop];
      },
      html: function(el) {
        return el.innerHTML;
      }
    },
    model;

exports._link = function(m) {
  model = m;
}

var events = exports.events = new EventDispatcher(
  function(listener, targetId) {
    var func = listener[0],
        path = listener[1],
        id = listener[2],
        method = listener[3],
        property = listener[4],
        el, value;
    if (id === targetId) {
      el = document.getElementById(id);
      if (!el) return false;
      value = getMethods[method](el, property);
      model[func].apply(null, [path, value]);
    }
    return true;
  }
);

var domHandler = function(e) {
  var e = e || event,
      target = e.target || e.srcElement;
  if (target.nodeType === 3) target = target.parentNode; // Fix for Safari bug
  events.trigger(e.type, target.id);
}
if (!_.onServer) {
  ['keyup', 'keydown'].forEach(function(item) {
    document['on' + item] = domHandler;
  });
}