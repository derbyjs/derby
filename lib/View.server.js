var path = require('path')
  , EventDispatcher = require('./EventDispatcher')
  , async = require('async')
  , md5 = require('MD5')
  , racer = require('racer')
  , mergeInto = racer.util.mergeInto
  , isProduction = racer.util.isProduction
  , files = require('./files')
  , htmlUtil = require('html-util')
  , escapeHtml = htmlUtil.escapeHtml
  , trimLeading = htmlUtil.trimLeading
  , refresh = require('./refresh.server')
  , View = module.exports = require('./View')
  , emptyModel = new racer.Model
  , emptyRes = {
      getHeader: empty
    , setHeader: empty
    , write: empty
    , end: empty
    }
  , emptyEventDispatcher = {
      bind: empty
    }

emptyModel._commit = empty;
emptyModel.bundle = empty;

function empty() {}

function escapeInlineScript(s) {
  return s.replace(/<\//g, '<\\/');
}

function stringifyData(object) {
  // Pretty the output in development
  var json = (isProduction) ?
    JSON.stringify(object) :
    JSON.stringify(object, null, 2);
  // Escape the output for use in a single-quoted attribute, since JSON will
  // contain lots of double quotes
  return json.replace(/[&']/g, function(match) {
    return (match === '&') ? '&amp;' : '&#39;';
  });
}

View.prototype.isServer = true;

View.prototype.inline = function(fn) {
  var script = "(" + fn + ")()";
  this._inline += script + ';';
};

View.prototype.render = function(res) {
  var view = this
    , i, arg, ctx, isStatic, model, ns;
  if (res == null) res = emptyRes;
  for (i = 1; i <= 5; i++) {
    arg = arguments[i];
    if (arg instanceof racer.Model) {
      model = arg;
    } else if (typeof arg === 'object') {
      ctx = arg;
    } else if (typeof arg === 'string') {
      ns = arg;
    } else if (typeof arg === 'number') {
      res.statusCode = arg;
    } else if (typeof arg === 'boolean') {
      isStatic = arg;
    }
  }
  if (model == null) model = emptyModel;
  ctx = this._beforeRender(model, ns, ctx);
  ctx.$url = res.req.url;

  this._load(isStatic, function(err, errors, css) {
    if (err) throw err;
    view._init(model);
    ctx.$viewModels = res._derbyViewModels;
    if (!isProduction) ctx.$scriptPath = view._scriptPath;
    view._render(res, model, ns, ctx, isStatic, errors, css);
  });
};

View.prototype._init = function(model) {
  // Initialize model and view for rendering
  if (model == null) model = emptyModel;
  model.__events = emptyEventDispatcher;
  model.__blockPaths = {};
  this._resetForRender(model);
  this._idCount = 0;
};

View.prototype._render = function(res, model, ns, ctx, isStatic, errors, css) {
  errors || (errors = {});

  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  res.setHeader('Cache-Control', 'no-store');

  try {
    // The view.get function renders and sets event listeners

    var doctype = this.get('doctype', ns, ctx);
    var root = this.get('root', ns, ctx);
    var charset = this.get('charset', ns, ctx);
    var title = escapeHtml(this.get('title$s', ns, ctx));
    var head = this.get('head', ns, ctx);
    var header = this.get('header', ns, ctx);

    css = '<style id=$_css>' + (css || '') + '</style>';

    // The first chunk includes everything through header. Head should contain
    // any meta tags and script tags, since it is included before CSS.
    // If there is a small amount of header HTML that will display well by itself,
    // it is a good idea to add this to the Header view so that it renders ASAP.
    res.write(
      doctype + root +
      '<head>' + charset + "<title>" + title + "</title>" + head + css + '</head>' +
      '<!--$_page-->' + header
    );

    // Remaining HTML
    var body = this.get('body', ns, ctx);
    var footer = this.get('footer', ns, ctx);
    var tail = this.get('tail', ns, ctx);
    res.write(body + footer + '<!--$$_page-->');

    ctx.$isServer = true;
    if (!isProduction) ctx.$renderHash = md5(header + body + footer);

  } catch (err) {
    errors['Template'] = refresh.templateError(err);
    res.write('<!DOCTYPE html><meta charset=utf-8><title></title>' + css);
  }

  // Display server-side rendering error stack trace in development
  if (!isProduction) tail += refresh.errorHtml(errors) || '';

  // Wait for transactions to finish and bundle up the racer model data

  // TODO: There is a potential race condition with rendering based on the
  // model before it is bundled. However, components may want to run init
  // code that performs model mutations, so we can't bundle until after that.
  // Figure out some solution to make sure that the client will have exactly
  // the same model data when rendering to set up browser events, etc.
  if (isStatic) {
    this._renderScripts(res, ns, ctx, isStatic, tail);
    return;
  }
  var view = this;
  model.destroy('$components');
  model.bundle(function(err, bundle) {
    view._renderScripts(res, ns, ctx, isStatic, tail, bundle);
  });
};

function flatten(object) {
  var out = {};
  for (var key in object) {
    out[key] = object[key];
  }
  return out;
}

View.prototype._renderScripts = function(res, ns, ctx, isStatic, tail, bundle) {
  // Inline scripts and external scripts
  var scripts = (this._inline) ?
    '<script>' + escapeInlineScript(this._inline) + '</script>' : '';
  scripts += this.get('scripts', ns, ctx);
  if (!isStatic) {
    scripts += "<script defer async onload='" +
      'require("derby").init(' +
      stringifyData(bundle) + ',' +
      stringifyData(flatten(ctx)) + ');this.removeAttribute("onload")' +
      "' src='" + this._scriptPath + "'></script>";
  }
  res.end(scripts + tail);
};

View.prototype._load = function(isStatic, callback) {
  // Wait for loading to complete if already loading
  if (this._loadCallbacks) {
    this._loadCallbacks.push(callback);
    return;
  }

  this._loadCallbacks = [callback];
  var view = this;
  loadAll(this, isStatic, function(err, errors, css) {
    if (err) return callback(err);
    // Only load from disk once in production
    if (isProduction) {
      view._load = function(isStatic, callback) {
        callback(null, errors, css);
      };
    }
    var cb;
    while (cb = view._loadCallbacks.shift()) {
      cb(null, errors, css);
    }
    // Once loading is complete, make the files reload from disk the next time
    delete view._loadCallbacks;
  });
};

View.prototype.pack = function(callback) {
  var view = this
    , appFilename = view._appFilename
    , fileInfo = files.parseName(appFilename)
    , root = fileInfo.root
    , clientName = fileInfo.clientName

  function finish(err) {
    callback(err, clientName);
  }
  racer.set('minify', true);

  view._loadStyles(root, clientName, function(err, css) {
    if (err) return finish(err);

    view._loadTemplates(root, clientName, function(err, templates, instances, libraryData) {
      if (err) return finish(err);
      var templatesScript = loadTemplatesScript(templates, instances, libraryData);
      // templatesScript = racer.get('minifyJs')(templatesScript);

      files.js(null, appFilename, {minify: true, debug: false}, function(err, js, inline) {
        files.writeJs(root, js + '\n;' + templatesScript, true, function(err, jsFile) {
          if (err) return finish(err);

          jsFile = jsFile.replace(/\\/g, '/');
          var filename = clientName + '.json'
            , file = JSON.stringify({
                css: css
              , templates: templates
              , instances: instances
              , libraryData: libraryData
              , inline: inline
              , jsFile: jsFile
              })
          files.writeGen(root, filename, file, true, finish);
        });
      });
    });
  });
};

function loadAll(view, isStatic, callback) {
  var errors = {};

  if (isStatic) {
    var root = view._root;
    var clientName = view._clientName;
  } else {
    var fileInfo = files.parseName(view._appFilename);
    var root = fileInfo.root;
    var clientName = fileInfo.clientName;
  }

  if (isProduction) {
    try {
      var dataFile = files.genInfo(root, clientName + '.json', true).filePath;
      var data = require(dataFile);
      view._makeAll(data.templates, data.instances);
      view._makeComponents(data.libraryData);
      return callback(null, null, data.css, data.jsFile);
    } catch (err) {
      // Don't do anything if the file isn't found or there is another error
    }
  }

  var css;
  async.parallel([
    function(cb) {
      view._loadStyles(root, clientName, function(err, value) {
        if (err) errors['CSS'] = refresh.cssError(err);
        css = value;
        cb();
      })
    }
  , function(cb) {
      view._loadTemplates(root, clientName, function(err) {
        if (err) errors['Template'] = refresh.templateError(err);
        cb();
      })
    }
  ], function(err) {
    callback(err, errors, css);
  });
}

View.prototype._loadBundle = function(callback) {
  var templatesScript;
  var view = this;
  if (isProduction) {
    if (this.bundleAndTemplates) return callback(null, this.bundleAndTemplates);
  } else if (this.bundle) {
    var view = this;
    var fileInfo = files.parseName(this._appFilename);
    loadTemplates(function(err) {
      if (err) return callback(err);
      callback(null, view.bundle + '\n' + templatesScript);
    });
    return;
  }

  var fileInfo = files.parseName(this._appFilename);
  async.parallel([loadTemplates, loadScripts], function(err) {
    if (err) return callback(err);
    view.bundleAndTemplates = view.bundle + '\n' + templatesScript;
    callback(null, view.bundleAndTemplates);
  });
  function loadTemplates(cb) {
    view._loadTemplates(fileInfo.root, fileInfo.clientName, function(err, templates, instances, libraryData) {
      // Ignore errors loading templates; will be notified separately
      templatesScript = loadTemplatesScript(templates, instances, libraryData);
      cb();
    });
  }
  function loadScripts(cb) {
    view._loadScripts(function(err, value) {
      if (err) return cb(err);
      view.bundle = value;
      cb();
    });
  }
};

View.prototype._loadScripts = function(callback) {
  var view = this;
  this.app.store.bundle(view._appFilename, function(err, bundle) {
    if (err) return callback(err);
    view._loadScripts = function(cb) {
      cb(err, bundle);
    };
    callback(err, bundle);
  });
};

// TODO: We are sending all libraries to all apps whether or not they
// are used. We should only be sending the libraries that each app needs
function loadTemplatesScript(templates, instances, libraryData) {
  return '(function() {\n' +
    'var view = require("derby").app.view;\n' +
    'view._makeAll(' +
      sortedJson(templates, 2) + ', ' +
      sortedJson(instances, 2) + ');\n' +
    'view._makeComponents(' +
      sortedJson(libraryData, 2) + ');\n' +
    '})();';
}

function sortedJson(obj, space) {
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj, null, space);
  }
  var out = []
    , key;
  for (key in obj) {
    out.push('"' + key + '": ' + sortedJson(obj[key], space));
  }
  return out.length ? '{\n  ' + out.sort().join(',\n  ') + '\n}' : '{}';
}

View.prototype._loadStyles = function(root, clientName, callback) {
  var styleFiles = []
    , out = []
    , libraries = this._libraries
    , minify = isProduction
    , len, i, library, styles

  function add(styles) {
    var file = path.resolve(library.root, styles);
    styleFiles.push(file);
  }

  for (i = 0, len = libraries.length; i < len; i++) {
    library = libraries[i];
    styles = library.styles;
    if (!styles) continue;
    if (Array.isArray(styles)) {
      styles.forEach(add);
    } else {
      add(styles);
    }
  }

  styleFiles.push(clientName);

  async.map(styleFiles, function(file, cb) {
    files.css(root, file, minify, function(err, value) {
      if (err) return cb(err);
      cb(null, minify ? trimLeading(value) : '\n' + value);
    });
  }, function(err, results) {
    if (err) return callback(err);
    callback(null, results.join('\n'));
  });
};

View.prototype._loadTemplates = function(root, clientName, callback) {
  var libraries = this._libraries;
  var libraryData = {};
  var templates;
  var instances;
  var view = this;
  async.parallel([
    function(cb) {
      files.templates(root, clientName, function(err, _templates, _instances) {
        if (err) {
          templates = {};
          instances = {};
        } else {
          templates = _templates;
          instances = _instances;
        }
        cb(err);
      });
    }
  , function(cb) {
      async.each(libraries, function(library, eachCb) {
        files.library(library.root, function(err, components) {
          if (err) return eachCb(err);
          var libraryTemplates = {}
            , libraryInstances = {}
            , componentName, component;
          for (componentName in components) {
            component = components[componentName];
            // TODO: Namespace component partials of each component
            mergeInto(libraryTemplates, component.templates);
            mergeInto(libraryInstances, component.instances);
          }
          libraryData[library.ns] = {
            templates: libraryTemplates
          , instances: libraryInstances
          };
          eachCb();
        });
      }, cb);
    }
  ], function(err) {
    if (err) return callback(err);
    view._makeAll(templates, instances);
    view._makeComponents(libraryData);
    callback(null, templates, instances, libraryData);
  });
};
