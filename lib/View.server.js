var path = require('path')
  , EventDispatcher = require('./EventDispatcher')
  , md5 = require('MD5')
  , racer = require('racer')
  , Promise = racer.util.Promise
  , merge = racer.util.merge
  , deepCopy = racer.util.deepCopy
  , finishAfter = racer.util.async.finishAfter
  , isProduction = racer.util.isProduction
  , files = require('./files')
  , htmlUtil = require('html-util')
  , escapeHtml = htmlUtil.escapeHtml
  , trimLeading = htmlUtil.trimLeading
  , refresh = require('./refresh.server')
  , View = module.exports = require('./View')
  , Model = racer['protected'].Model
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

View.prototype.isServer = true;

View.prototype.inline = function(fn) {
  var script = "(" + fn + ")()";
  if (racer.get('minify')) {
    script = racer.get('minifyJs')(script);
  }
  this._inline += script + ';';
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
  ctx = this._beforeRender(model, ns, ctx);

  this._load(isStatic, function(err, errors, css, jsFile, appHash) {
    if (err) throw err;
    view._init(model);
    ctx.$appHash = appHash;
    ctx.$viewModels = res._derbyViewModels;
    view._render(res, model, ns, ctx, isStatic, errors, css, jsFile);
  });
};

View.prototype._init = function(model) {
  // Initialize model and view for rendering
  if (model == null) model = emptyModel;
  model.__events = emptyEventDispatcher;
  model.__blockPaths = {};
  model.__pathMap = emptyPathMap;
  this._resetForRender(model);
};

View.prototype._render = function(res, model, ns, ctx, isStatic, errors, css, jsFile) {
  errors || (errors = {});

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
      , body, footer, tail;

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
    body = this.get('body', ns, ctx);
    footer = this.get('footer', ns, ctx);
    tail = this.get('tail', ns, ctx);
    res.write(body + footer + '<!--$$_page-->');

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
    view._renderScripts(res, ns, ctx, isStatic, jsFile, tail);
    return;
  }
  model.del('_$components');
  model.bundle(function(bundle) {
    view._renderScripts(res, ns, ctx, isStatic, jsFile, tail, bundle);
  });
};

View.prototype._renderScripts = function(res, ns, ctx, isStatic, jsFile, tail, bundle) {
  // Inline scripts and external scripts
  var scripts = this._inline ? '<script>' + escapeInlineScript(this._inline) + '</script>' : '';
  scripts += this.get('scripts', ns, ctx);
  if (!isStatic) {
    scripts += '<script id=$_js defer async onload="this.loaded=true" src=' + jsFile + '></script>';
  }
  res.write(scripts);

  // Initialization script and Tail
  if (isStatic) return res.end(tail);

  res.end("<script>setTimeout(function(){" +
    "var el = document.getElementById('$_js');" +
    "el.loaded ? init() : el.onload = init;" +
    "function init(){" +
      "DERBY.init(" + escapeInlineScript(bundle) + "," +
        escapeInlineScript(JSON.stringify(deepCopy(ctx))) + ")" +
    "}" +
  "},0)</script>" + tail);
};

View.prototype._load = function(isStatic, callback) {
  // Wait for loading to complete if already loading
  if (this._loadCallbacks) {
    this._loadCallbacks.push(callback);
    return;
  }

  this._loadCallbacks = [callback];
  var view = this;

  function resolve(err, errors, css, jsFile, appHash) {
    var cb;
    while (cb = view._loadCallbacks.shift()) {
      cb(err, errors, css, jsFile, appHash);
    }
    // Once loading is complete, make the files reload from disk the next time
    delete view._loadCallbacks;
  }

  loadAll(this, isStatic, function(err, errors, css, jsFile, appHash) {
    view._appHash = appHash;
    if (err) return resolve(err);
    // Only load from disk once in production
    if (isProduction) {
      view._load = function(isStatic, callback) {
        callback(null, errors, css, jsFile, appHash);
      };
    }
    resolve(null, errors, css, jsFile, appHash);
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
      templatesScript = racer.get('minifyJs')(templatesScript);

      files.js(appFilename, {minify: true, debug: false}, function(err, js, inline) {
        files.writeJs(root, js + '\n;' + templatesScript, true, function(err, jsFile, appHash) {
          if (err) return finish(err);

          var filename = clientName + '.json'
            , file = JSON.stringify({
                css: css
              , templates: templates
              , instances: instances
              , libraryData: libraryData
              , inline: inline
              , jsFile: jsFile
              , appHash: appHash
              })
          files.writeGen(root, filename, file, true, finish);
        });
      });
    });
  });
};

function loadAll(view, isStatic, callback) {
  var errors = {}
    , appFilename, fileInfo, root, clientName, dataFile, data

  if (isStatic) {
    root = view._root;
    clientName = view._clientName;
  } else {
    appFilename = view._appFilename;
    fileInfo = files.parseName(appFilename);
    root = fileInfo.root;
    clientName = fileInfo.clientName;
  }

  if (isProduction) {
    try {
      dataFile = files.genInfo(root, clientName + '.json', true).filePath;
      data = require(dataFile);
      view._makeAll(data.templates, data.instances);
      view._makeComponents(data.libraryData);
      return callback(null, null, data.css, data.jsFile, data.appHash);
    } catch (err) {
      // Don't do anything if the file isn't found or there is another error
    }
  }

  view._loadStyles(root, clientName, function(err, css) {
    if (err) errors['CSS'] = refresh.cssError(err);

    view._loadTemplates(root, clientName, function(err, templates, instances, libraryData) {
      if (err) errors['Template'] = refresh.templateError(err);
      view._makeAll(templates, instances);
      view._makeComponents(libraryData);
      var templatesScript = loadTemplatesScript(templates, instances, libraryData);
      if (racer.get('minify')) {
        templatesScript = racer.get('minifyJs')(templatesScript);
      }

      // Don't include JS for static pages
      if (isStatic) return callback(null, errors, css);

      // JS files are only loaded once per process start
      if (view._js) return finish(view._js);

      files.js(appFilename, function(err, js, inline) {
        if (err) return callback(err);
        if (inline) view.inline("function(){" + inline + "}");
        view._js = js;
        finish(js);
      });

      function finish(js) {
        files.writeJs(root, js + '\n;' + templatesScript, false, function(err, jsFile, appHash) {
          if (err) return callback(err);
          callback(err, errors, css, jsFile, appHash);
        });
      }
    });
  });
}

// TODO: We are sending all libraries to all apps whether or not they
// are used. We should only be sending the libraries that each app needs
function loadTemplatesScript(templates, instances, libraryData) {
  return '(function() {\n' +
    'var view = DERBY.app.view;\n' +
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
    , minify = racer.get('minify')
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
    files.css(root, file, minify, function(err, value) {
      out[i] = minify ? trimLeading(value) : '\n' + value;
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
  });
};
