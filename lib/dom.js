var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher'),
    doc = _.onServer ? null : document,
    win = _.onServer ? null : window,
    elements = {
      '__document': doc,
      '__window': win
    },
    emptyEl = doc ? doc.createElement('div') : null,
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
    setMethods = {
      attr: function(value, el, attr) {
        el.setAttribute(attr, value);
      },
      prop: function(value, el, prop) {
        el[prop] = value;
      },
      propLazy: function(value, el, prop) {
        if (el !== doc.activeElement) el[prop] = value;
      },
      html: function(value, el, escape) {
        if (escape) el.innerHTML = view.htmlEscape(value);
      },
      appendHtml: function(value, el) {
        var child;
        emptyEl.innerHTML = value;
        while (child = emptyEl.firstChild) {
          el.appendChild(child);
        }
      }
    },
    model, view;

exports._link = function(m, v) {
  model = m;
  view = v;
}

exports.update = function(id, method, property, viewFunc, value, options) {
  el = elements[id] || (elements[id] = doc.getElementById(id));
  // The element can't be found, so indicate that update failed
  if (!el) return false;
  switch (options) {
    case 'push':
      s = view._get(viewFunc, value[value.length - 1]);
      setMethods.appendHtml(s, el);
      break;
    default:
      s = (viewFunc) ? view._get(viewFunc, value) : value;
      setMethods[method](s, el, property);
  }
  return true;
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
      el = doc.getElementById(id);
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
    doc['on' + item] = domHandler;
  });
}