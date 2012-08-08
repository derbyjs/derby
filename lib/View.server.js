var path = require('path')
  , EventDispatcher = require('./EventDispatcher')
  , racer = require('racer')
  , Promise = racer.util.Promise
  , isProduction = racer.util.isProduction
  , merge = racer.util.merge
  , finishAfter = racer.util.async.finishAfter
  , Model = racer["protected"].Model
  , uglify = require('racer/node_modules/uglify-js')
  , files = require('./files')
  , htmlUtil = require('html-util')
  , escapeHtml = htmlUtil.escapeHtml
  , trimLeading = htmlUtil.trimLeading
  , refresh = require('./refresh.server')
  , errorHtml = refresh.errorHtml
  , cssError = refresh.cssError
  , templateError = refresh.templateError
  , View = module.exports = require('./View')
  , emptyModel = new Model
  , emptyRes = {
      getHeader: empty
    , setHeader: empty
    , write: empty
    , end: empty
    }
  , emptyPathMap = {
      id: empty
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

// TODO: We are sending all libraries to all apps whether or not they
// are used. We should only be sending the libraries that each app needs
function loadTemplatesScript(templates, instances, libraryData) {
  return '(function() {\n' +
    'var view = DERBY.view;\n' +
    'view._makeAll(' +
      sortedJson(templates, 2) + ', ' +
      sortedJson(instances, 2) + ');\n' +
    'view._makeComponents(' +
      sortedJson(libraryData, 2) + ');\n' +
    '})();';
}

View.prototype.isServer = true;

View.prototype.inline = function(fn) {
  var script = "(" + fn + ")()";
  if (isProduction) script = uglify(script);
  this._inline += script + ';';
};

View.prototype._load = function(isStatic, callback) {
  var view = this
    , appFilename, clientName, count, errors, finish, js, options
    , promise, root, libraries, fileInfo, loadTemplates;

  if (isProduction) {
    this._watch = false;
    this._load = function(isStatic, callback) {
      callback();
    };
  } else {
    this._watch = true;
  }

  // Use a promise to avoid simultaneously loading multiple times
  if (promise = this._loadPromise) {
    return promise.on(callback);
  }
  promise = this._loadPromise = (new Promise).on(callback);

  // Once loading is complete, make the files reload from disk the next time
  promise.on(function() {
    delete view._loadPromise;
  });

  errors = {};

  if (isStatic) {
    root = this._root;
    clientName = this._clientName;
    count = 2;
    finish = function() {
      if (--count) return;
      promise.resolve();
    };

  } else {
    appFilename = this._appFilename;
    options = this._derbySettings || {};
    fileInfo = files.parseName(appFilename, options);
    this._root = root = fileInfo.root;
    this._clientName = clientName = fileInfo.clientName;
    if (!clientName) promise.resolve();

    count = 3;
    finish = function() {
      if (--count) return;

      if (!js) return promise.resolve();

      // Templates are appended to the js bundle here so that it does
      // not have to be regenerated if only the template files are modified
      if (isProduction) loadTemplates = uglify(loadTemplates);
      js += '\n;' + loadTemplates;

      view._errors = errorHtml(errors) || '';

      files.writeJs(root, js, options, function(err, jsFile, appHash) {
        if (err) throw err;
        view._jsFile = jsFile;
        view._appHash = appHash;
        promise.resolve();
      });
    };

    if (this._js) {
      js = this._js;
      finish();

    } else {
      files.js(appFilename, function(err, value, inline) {
        if (err) throw err;
        js = value;
        if (!isProduction) view._js = value;
        if (inline) view.inline("function(){" + inline + "}");
        finish();
      });
    }
  }

  this._loadCss(root, clientName, function(err, css) {
    if (err) {
      css = '<style id=$_css></style>';
      errors['CSS'] = cssError(err);
    } else {
      css = css ? '<style id=$_css>' + css + '</style>' : '';
    }
    view._css = css;
    finish();
  });

  libraries = this._libraries;
  this._loadTemplates(root, clientName, function(err, templates, instances, libraryData) {
    if (err) errors['Template'] = templateError(err);
    view._makeAll(templates, instances);
    loadTemplates = loadTemplatesScript(templates, instances, libraryData);
    view._makeComponents(libraryData);
    finish();
  });
};

View.prototype._loadCss = function(root, clientName, callback) {
  var styleFiles = []
    , out = []
    , libraries = this._libraries
    , len, i, library, styles, finish

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

  finish = finishAfter(styleFiles.length, function(err) {
    if (err) return callback(err);
    callback(null, out.join(''));
  });

  styleFiles.forEach(function(file, i) {
    files.css(root, file, isProduction, function(err, value) {
      out[i] = isProduction ? trimLeading(value) : '\n' + value;
      finish(err);
    });
  });
};

View.prototype._loadTemplates = function(root, clientName, callback) {
  var libraries = this._libraries
    , libraryData = {}
    , templates, instances, finish

  finish = finishAfter(libraries.length + 1, function(err) {
    callback(err, templates, instances, libraryData);
  });

  files.templates(root, clientName, function(err, _templates, _instances) {
    if (err) {
      templates = {};
      instances = {};
    } else {
      templates = _templates;
      instances = _instances;
    }
    finish(err);
  });

  libraries.forEach(function(library) {
    files.library(library.root, function(err, components) {
      if (err) return finish(err);
      var libraryTemplates = {}
        , libraryInstances = {}
        , componentName, component;
      for (componentName in components) {
        component = components[componentName];
        // TODO: Namespace component partials of each component
        merge(libraryTemplates, component.templates);
        merge(libraryInstances, component.instances);
      }
      libraryData[library.ns] = {
        templates: libraryTemplates
      , instances: libraryInstances
      };
      finish();
    });
  })
};

View.prototype.render = function(res) {
  var view = this
    , i, arg, ctx, isStatic, model, ns;
  if (res == null) res = emptyRes;
  for (i = 1; i <= 5; i++) {
    arg = arguments[i];
    if (arg instanceof Model) {
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
  ctx = this._beforeRender(ns, ctx);

  this._init(model, isStatic, function() {
    view._render(res, model, ns, ctx, isStatic);
  });
};

View.prototype._initValues = function(model) {
  // Initialize view for rendering
  this.model = model;
  this._idCount = 0;
  var libraries = this._libraries
    , i
  for (i = libraries.length; i--;) {
    libraries[i].view._initValues(model);
  }
};

View.prototype._init = function(model, isStatic, callback) {
  var view = this;
  // Load templates, css, and scripts from files
  this._load(isStatic, function() {
    // Initialize model for rendering
    model.__events = emptyEventDispatcher;
    model.__blockPaths = {};
    model.__pathMap = emptyPathMap;
    view._initValues(model);
    callback();
  });
};

View.prototype._render = function(res, model, ns, ctx, isStatic) {

  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }

  try {
    // The view.get function renders and sets event listeners

    var view = this
      , doctype = this.get('doctype', ns, ctx)
      , root = this.get('root', ns, ctx)
      , charset = this.get('charset', ns, ctx)
      , title = escapeHtml(this.get('title$s', ns, ctx))
      , head = this.get('head', ns, ctx)
      , header = this.get('header', ns, ctx)
      , body, scripts, tail;

    // The first chunk includes everything through header. Head should contain
    // any meta tags and script tags, since it is included before CSS.
    // If there is a small amount of header HTML that will display well by itself,
    // it is a good idea to add this to the Header view so that it renders ASAP.
    res.write(doctype + root + charset + "<title>" + title + "</title>" + head + this._css + header);

    // Remaining HTML
    body = this.get('body', ns, ctx) + this.get('footer', ns, ctx);
    if (body.slice(0, 4) === '<!--') {
      body = '&shy;' + body;
    }
    res.write(body);
  } catch (err) {
    var errText = templateError(err);
    if (!this._errors) this._errors = errorHtml({Template: errText});
    res.write('<!DOCTYPE html><meta charset=utf-8><title></title>' + this._css);
  }

  tail = this.get('tail', ns, ctx);

  // Wait for transactions to finish and package up the racer model data

  // TODO: There is a potential race condition with rendering based on the
  // model before it is bundled. However, components may want to run init
  // code that performs model mutations, so we can't bundle until after that.
  // Figure out some solution to make sure that the client will have exactly
  // the same model data when rendering to set up browser events, etc.
  if (isStatic) {
    return view._renderScripts(res, ns, ctx, isStatic, tail);
  }
  model.bundle(function(bundle) {
    view._renderScripts(res, ns, ctx, isStatic, tail, bundle);
  });
};

View.prototype._renderScripts = function(res, ns, ctx, isStatic, tail, bundle) {
  var clientName = this._clientName;

  // Inline scripts and external scripts
  scripts = this._inline ? '<script>' + escapeInlineScript(this._inline) + '</script>' : '';
  scripts += this.get('scripts', ns, ctx);
  if (!isStatic) {
    scripts += '<script id=$_js defer async onload="this.loaded=true" src=' + this._jsFile + '></script>';
  }
  res.write(scripts);

  // Initialization script and Tail
  if (isStatic) return res.end(tail);

  res.end('<script>setTimeout(function(){' +
    'var el = document.getElementById("$_js");' +
    'el.loaded ? init() : el.onload = init;' +
    'function init(){' +
      'DERBY.init(' + escapeInlineScript(bundle) + ',"' +
      this._appHash + '",' + (+this._watch) + ',"' + (ns || '') + '"' +
      (ctx ? ',' + escapeInlineScript(JSON.stringify(ctx)) : '') + ')' +
    '}' +
  '},0)</script>' + tail + this._errors);
};
