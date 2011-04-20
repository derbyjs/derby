var _ = require('./utils'),
    htmlParser = require('./htmlParser'),
    views = {},
    loadFuncs = '',
    clientName, jsFile, dom, model;

exports._link = function(d, m) {
  dom = d;
  model = m;
}
exports._setClientName = function(s) {
  clientName = s;
};
exports._setJsFile = function(s) {
  jsFile = s;
};

var uniqueId = exports.uniqueId = function() {
  return '_' + (uniqueId._count++).toString(36);
};
uniqueId._count = 0;

var get = exports._get = function(view, obj) {
  view = views[view];
  return (view) ?
    (_.isArray(obj) ? obj.reduce(function(memo, item) {
      return memo + view(item);
    }, '') : view(obj)) : '';
};

// Adapted from function in Mustache.js
var htmlEscape = exports.htmlEscape = function(s) {
  s = String(s === null ? '' : s);
  return s.replace(/[&<>]/g, function(s) {
    switch (s) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      default: return s;
    }
  });
};
function quoteAttr(s) {
  s = String(s === null ? '' : s).replace(/"/g, '&quot;');
  return s ? (/[ =]/.test(s) ? '"' + s + '"' : s) : '""';
}

function parse(template) {
  var stack = [],
      events = [],
      html = [''],
      htmlIndex = 0,
      elementParse;

  function modelText(name, escaped, quote) {
    return function(data) {
      var datum = data[name],
          obj = datum.model ? model.get(datum.model) : datum,
          text = datum.view ? get(datum.view, obj) : obj;
      if (escaped) text = htmlEscape(text);
      if (quote) text = quoteAttr(text);
      return text;
    }
  }
  
  function extractPlaceholder(text) {
    var match = /^(.*?)(\{{2,3})(\w+)\}{2,3}(.*)$/.exec(text);
    return (match) ? {
      pre: match[1],
      escaped: match[2] === '{{',
      name: match[3],
      post: match[4]
    } : null;
  }
  
  elementParse = {
    input: function(attr, attrs, name) {
      var method, setMethod, domArgs;
      if (attr === 'value') {
        method = 'propLazy';
        setMethod = 'set';
        if ('silent' in attrs) {
          method = 'prop';
          setMethod = 'setSilent';
          // This need not be in the HTML output
          delete attrs.silent;
        }
        events.push(function(data) {
          domArgs = [setMethod, data[name].model, attrs._id || attrs.id, 'prop', 'value'];
          dom.events.bind('keyup', domArgs);
          dom.events.bind('keydown', domArgs);
        });
      } else {
        method = 'attr';
      }
      return method;
    }
  };
  
  htmlParse = {
    start: function(tag, attrs) {
      _.forEach(attrs, function(key, value) {
        var match, name, method, setMethod;
        if (match = extractPlaceholder(value)) {
          name = match.name;
          if (_.isUndefined(attrs.id)) {
            attrs.id = function() { return attrs._id = uniqueId(); };
          }
          method = (tag in elementParse) ?
            elementParse[tag](key, attrs, name) : 'attr';
          events.push(function(data) {
            var path = data[name].model;
            if (path) {
              model.events.bind(path, [attrs._id || attrs.id, method, key]);
            }
          });
          attrs[key] = modelText(name, match.escaped, true);
        }
      });
      stack.push(['start', tag, attrs]);
    },
    chars: function(text) {
      var last, attrs, match, name, escaped, pre, post;
      text = text.replace(/\n *$/, '');
      if (match = extractPlaceholder(text)) {
        name = match.name;
        escaped = _.toNumber(match.escaped);
        pre = match.pre;
        post = match.post;
        
        if (pre) stack.push(['chars', pre]);
        if (pre || post) stack.push(['start', 'span', {}]);
        
        text = modelText(name, escaped);
        last = stack[stack.length - 1];
        if (last[0] === 'start') {
          attrs = last[2];
          if (_.isUndefined(attrs.id)) {
            attrs.id = function() { return attrs._id = uniqueId(); };
          }          
          events.push(function(data) {
            var path = data[name].model,
                viewFunc = data[name].view,
                params = [attrs._id || attrs.id, 'html', escaped];
            if (path) {
              if (viewFunc) params.push(viewFunc);
              model.events.bind(path, params);
            }
          });
        }
      }
      if (text) stack.push(['chars', text]);
      if (pre || post) stack.push(['end', 'span']);
      if (post) htmlParse.chars(post);
    },
    end: function(tag) {
      stack.push(['end', tag]);
    }
  };
  
  htmlParser.parse(template, htmlParse);

  stack.forEach(function(item) {
    function pushValue(value, quote) {
      if (_.isFunction(value)) {
        htmlIndex = html.push(value, '') - 1;
      } else {
        html[htmlIndex] += quote ? quoteAttr(value) : value;
      }
    }
    switch (item[0]) {
      case 'start':
        html[htmlIndex] += '<' + item[1];
        _.forEach(item[2], function(key, value) {
          html[htmlIndex] += ' ' + key + '=';
          pushValue(value, true);
        });
        html[htmlIndex] += '>';
        return;
      case 'chars':
        pushValue(item[1]);
        return;
      case 'end':
        html[htmlIndex] += '</' + item[1] + '>';
    }
  });

  return function(data, obj) {
    var rendered = html.reduce(function(memo, item) {
      return memo + (_.isFunction(item) ? item(data) : item);
    }, '');
    events.forEach(function(item) { item(data); });
    return rendered;
  };
};

var preLoad = exports.preLoad = function(func) {
  loadFuncs += '(' + func.toString() + ')();';
};

function simpleView(name) {
  return function(datum) {
    var path = datum.model,
        obj = path ? model.get(path) : datum,
        text = datum.view ? get(datum.view, obj) : obj;
    if (path) {
      if (name === 'Title') {
        model.events.bind(path, ['__document', 'prop', 'title']);
      }
    }
    return text;
  };
};

exports.make = function(name, data, template, options) {
  var after = options && options.after,
      render = function() {
          render = (template) ? parse(template) : simpleView(name);
          return render.apply(null, arguments);
        }
      func = _.isFunction(data) ?
        function() { return render(data.apply(null, arguments)); } :
        function() { return render(data); };
  if (_.onServer) {
    if (after) preLoad(after);
    views[name] = func;
  } else {
    views[name] = (after) ?
      function() {
        setTimeout(after, 0);
        return func.apply(null, arguments);
      } : func;
  }
};

if (_.onServer) {
  exports.html = function() {
    var title, head, body, foot;
    model.events._names = {};
    dom.events._names = {};
    uniqueId._count = 0;
    
    // Note that view getter functions create event handlers on the model and
    // DOM, so they have to be called before the events are serialized below
    title = get('Title');
    head = get('Head');
    body = get('Body');
    foot = get('Foot');
    
    return '<!DOCTYPE html>' + '<title>' + title + '</title>' + head + body +
      '<script>function $(s){return document.getElementById(s)}' + 
      _.minify(loadFuncs, true) + '</script>' +
      '<script src=' + jsFile + '></script>' +
      '<script>var ' + clientName + '=require("./' + clientName + '")(' +
      uniqueId._count + ',' +
      JSON.stringify(model.get()).replace(/<\//g, '<\\/') + ',' +
      JSON.stringify(model.events.get()) + ',' +
      JSON.stringify(dom.events.get()) + ');</script>' + foot;
  };
} else { } // Workaround for uglify
