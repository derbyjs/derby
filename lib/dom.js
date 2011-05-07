var _ = require('./utils'),
    EventDispatcher = require('./EventDispatcher'),
    win = !_.onServer && window,
    doc = win && win.document,
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
      prop: function(value, el, props) {
        var i, prop, last;
        if (_.isArray(props)) {
          last = props.length - 1;
          for (var i = 0; i < last; i++) {
            el = el[props[i]];
          }
          prop = props[last];
        } else {
          prop = props;
        }
        el[prop] = value;
      },
      propPolite: function(value, el, prop) {
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

function element(id) {
  return elements[id] || (elements[id] = doc.getElementById(id));
}
exports.update = function(id, method, property, viewFunc, value) {
  var el = element(id);
  // The element can't be found, so indicate that update failed
  if (!el) return false;
  s = (viewFunc) ? view._get(viewFunc, value) : value;
  setMethods[method](s, el, property);
}

function onTrigger(name, listener, targetId) {
  var func = listener[0],
      path = listener[1],
      id = listener[2],
      method = listener[3],
      property = listener[4],
      el, value;
  if (id === targetId) {
    el = element(id);
    if (!el) return false;
    value = getMethods[method](el, property);
    model[func].apply(null, [path, value]);
  }
}
function onBind(name) {
  if (!(name in events._names)) addListener(name);
}
var events = exports.events = new EventDispatcher(onTrigger, onBind);

function domHandler(e) {
  var e = e || event,
      target = e.target || e.srcElement;
  if (target.nodeType === 3) target = target.parentNode; // Fix for Safari bug
  events.trigger(e.type, target.id);
}
var addListener, removeListener;
if (doc.addEventListener) {
  addListener = function(name) {
    doc.addEventListener(name, domHandler, false);
  }
  removeListener = function(name) {
    doc.removeEventListener(name, domHandler, false);
  }
} else if (doc.attachEvent) {
  addListener = function(name) {
    doc.attachEvent('on' + name, domHandler);
  }
  removeListener = function(name) {
    doc.detachEvent('on' + name, domHandler);
  }
} else {
  addListener = removeListener = function() {};
}
exports.addListener = addListener;
exports.removeListener = removeListener;

exports.init = function(domEvents) {
  events.set(domEvents);
  Object.keys(events._names).forEach(addListener);
};