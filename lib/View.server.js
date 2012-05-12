var EventDispatcher = require('./EventDispatcher')
  , racer = require('racer')
  , Promise = racer.util.Promise
  , isProduction = racer.util.isProduction
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

  , emptyRes = {
      getHeader: empty
    , setHeader: empty
    , write: empty
    , end: empty
    }
  , emptyPathMap = {
      id: empty
    }
  , emptyModel = {
      get: empty
    , bundle: empty
    , __pathMap: emptyPathMap
    }
  , emptyEventDispatcher = {
      bind: empty
    }
  , emptyDom = {
      bind: empty
    }

function empty() {}

function escapeInlineScript(s) {
  return s.replace(/<\//g, '<\\/');
}

function loadTemplatesScript(requirePath, templates, instances) {
  return "(function() {\n  require('" + requirePath + "').view._makeAll(\n    " +
    (JSON.stringify(templates, null, 2)) + ", " +
    (JSON.stringify(instances, null, 2)) + "\n  );\n})();";
}

View.prototype.inline = function(fn) {
  return this._inline += uglify("(" + fn + ")()") + ';';
};

View.prototype._load = function(isStatic, callback) {
  var view = this
    , appFilename, clientName, count, errors, finish, instances, js, options
    , promise, requirePath, root, templates, fileInfo;

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

  templates = instances = js = null;
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
    options = this._derbyOptions || {};
    fileInfo = files.parseName(appFilename, options);
    this._root = root = fileInfo.root;
    this._requirePath = requirePath = fileInfo.require;
    this._clientName = clientName = fileInfo.clientName;
    if (!clientName) promise.resolve();

    count = 3;
    finish = function() {
      var loadTemplates;
      if (--count) return;

      // Templates are appended to the js bundle here so that it does
      // not have to be regenerated if only the template files are modified
      loadTemplates = loadTemplatesScript(requirePath, templates, instances);
      if (isProduction) loadTemplates = uglify(loadTemplates);
      js += ';' + loadTemplates;

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

  files.css(root, clientName, isProduction, function(err, value) {
    if (err) {
      view._css = '<style id=$_css></style>';
      errors['CSS'] = cssError(err);
      return finish();
    }
    value = isProduction ? trimLeading(value) : '\n' + value;
    view._css = value ? "<style id=$_css>" + value + "</style>" : '';
    finish();
  });

  files.templates(root, clientName, function(err, _templates, _instances) {
    if (err) {
      templates = {};
      instances = {};
      errors['Template'] = templateError(err);
    } else {
      templates = _templates;
      instances = _instances;
    }
    view._makeAll(templates, instances);
    finish();
  });
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

  // Load templates, css, and scripts from files
  this._load(isStatic, function() {
    if (isStatic) return view._render(res, model, ns, ctx, isStatic);

    // Wait for transactions to finish and package up the racer model data
    model.bundle(function(bundle) {
      view._render(res, model, ns, ctx, isStatic, bundle);
    });
  });
};

View.prototype._init = function(model) {
  // Initialize view & model for rendering
  this.dom = emptyDom;
  model.__events = emptyEventDispatcher;
  model.__blockPaths = {};
  model.__pathMap = emptyPathMap;
  this.model = model;
  this._idCount = 0;
  var libraries = this._libraries
    , name
  for (name in libraries) {
    libraries[name].view._init(model);
  }
};

View.prototype._render = function(res, model, ns, ctx, isStatic, bundle) {
  this._init(model);

  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }

  try {
    // The view.get function renders and sets event listeners

    var doctype = this.get('doctype', ns, ctx)
      , root = this.get('root', ns, ctx)
      , charset = this.get('charset', ns, ctx)
      , title = escapeHtml(this.get('title$s', ns, ctx))
      , head = this.get('head', ns, ctx)
      , header = this.get('header', ns, ctx)
      , clientName = this._clientName
      , scripts, tail;

    // The first chunk includes everything through header. Head should contain
    // any meta tags and script tags, since it is included before CSS.
    // If there is a small amount of header HTML that will display well by itself,
    // it is a good idea to add this to the Header view so that it renders ASAP.
    res.write(doctype + root + charset + "<title>" + title + "</title>" + head + this._css + header);

    // Remaining HTML
    res.write(this.get('body', ns, ctx) + this.get('footer', ns, ctx));
  } catch (err) {
    var errText = templateError(err);
    if (!this._errors) this._errors = errorHtml({Template: errText});
    res.write('<!DOCTYPE html><meta charset=utf-8><title></title>' + this._css);
  }

  // Inline scripts and external scripts
  scripts = "<script>";
  if (!isStatic) {
    scripts += "function " + clientName + "(){" + clientName + "=1}";
  }
  scripts += escapeInlineScript(this._inline) + "</script>" + this.get('scripts', ns, ctx);
  if (!isStatic) {
    scripts += "<script defer async onload=" + clientName + "() src=" + this._jsFile + "></script>";
  }
  res.write(scripts);

  // Initialization script and Tail
  tail = this.get('tail', ns, ctx);
  if (isStatic) return res.end(tail);

  res.end("<script>(function(){function f(){setTimeout(function(){" + clientName +
    "=require('" + this._requirePath + "')(" + escapeInlineScript(bundle) + ",'" +
    this._appHash + "'," + (+this._watch) + ",'" + (ns || '') + "'" +
    (ctx ? ',' + escapeInlineScript(JSON.stringify(ctx)) : '') + ")},0)}" +
    clientName + "===1?f():" + clientName + "=f})()</script>" + tail + this._errors);
};
