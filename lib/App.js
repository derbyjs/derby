/*
 * App.js
 *
 * Provides the glue between views, controllers, and routes for an
 * application's functionality. Apps are responsible for creating pages.
 *
 */

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var tracks = require('tracks');
var util = require('racer/lib/util');
var derbyTemplates = require('derby-templates');
var templates = derbyTemplates.templates;
var components = require('./components');
var PageBase = require('./Page');
var serializedViews = require('./_views');

module.exports = App;

globalThis.APPS = globalThis.APPS || new Map();

App.register = function register(name) {
  if (!globalThis.APPS.has(name)) {
    globalThis.APPS.set(name, {
      attached: false,
      initialState: null,
    });
  }
}

function App(derby, name, filename, options) {
  EventEmitter.call(this);
  this.derby = derby;
  this.name = name;
  this.filename = filename;
  this.scriptHash = '{{DERBY_SCRIPT_HASH}}';
  this.bundledAt = '{{DERBY_BUNDLED_AT}}';
  this.Page = createAppPage(derby);
  this.proto = this.Page.prototype;
  this.views = new templates.Views();
  this.tracksRoutes = tracks.setup(this);
  this.model = null;
  this.page = null;
  this._pendingComponentMap = {};
  this._init(options);
  App.register(name);
}

function createAppPage(derby) {
  var Page = (derby && derby.Page) || PageBase;
  // Inherit from Page/PageForServer so that we can add controller functions as prototype
  // methods on this app's pages
  function AppPage() {
    Page.apply(this, arguments);
  }
  AppPage.prototype = Object.create(Page.prototype);
  return AppPage;
}

util.mergeInto(App.prototype, EventEmitter.prototype);

// Overriden on server
App.prototype._init = function() {
  this._waitForAttach = true;
  this._cancelAttach = false;
  this.model = new this.derby.Model();
  serializedViews(derbyTemplates, this.views);
  // Must init async so that app.on('model') listeners can be added.
  // Must also wait for content ready so that bundle is fully downloaded.
  this._contentReady();
};

App.prototype._finishInit = function() {
  var script = this._getAppStateScript();
  var data = App._parseInitialData(script.nextSibling.innerHTML);
  this.model.createConnection(data);
  this.emit('model', this.model);
  util.isProduction = data.nodeEnv === 'production';
  if (!util.isProduction) this._autoRefresh();
  this.model.unbundle(data);
  var page = this.createPage();
  page.params = this.model.get('$render.params');
  this.emit('ready', page);
  this._waitForAttach = false;
  // Instead of attaching, do a route and render if a link was clicked before
  // the page finished attaching
  if (this._cancelAttach || this._isAttached()) {
    this.history.refresh();
    return;
  }
  // Since an attachment failure is *fatal* and could happen as a result of a
  // browser extension like AdBlock, an invalid template, or a small bug in
  // Derby or Saddle, re-render from scratch on production failures
  if (util.isProduction) {
    try {
      page.attach();
    } catch (err) {
      this.history.refresh();
      console.warn('attachment error', err.stack);
    }
  } else {
    page.attach();
  }
  this.emit('load', page);
};

App.prototype._isAttached = function isInitialized() {
  const { attached } = globalThis.APPS.get(this.name);
  return attached;
}

App.prototype._persistInitialState = function persistInitialState(state) {
  if (this._isAttached()) {
    return;
  }
  globalThis.APPS.set(this.name, {
    attached: true,
    initialState: state,
  });
}

App.prototype._initialState = function initialState() {
  const { initialState } = globalThis.APPS.get(this.name);
  return initialState;
}

// Modified from: https://github.com/addyosmani/jquery.parts/blob/master/jquery.documentReady.js
App.prototype._contentReady = function() {
  // Is the DOM ready to be used? Set to true once it occurs.
  var isReady = false;
  var app = this;

  // The ready event handler
  function onDOMContentLoaded() {
    if (document.addEventListener) {
      document.removeEventListener('DOMContentLoaded', onDOMContentLoaded, false);
    } else {
      // we're here because readyState !== 'loading' in oldIE
      // which is good enough for us to call the dom ready!
      document.detachEvent('onreadystatechange', onDOMContentLoaded);
    }
    onDOMReady();
  }

  // Handle when the DOM is ready
  function onDOMReady() {
    // Make sure that the DOM is not already loaded
    if (isReady) return;
    // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
    if (!document.body) return setTimeout(onDOMReady, 0);
    // Remember that the DOM is ready
    isReady = true;
    // Make sure this is always async and then finishin init
    setTimeout(function() {
      app._finishInit();
    }, 0);
  }

  // The DOM ready check for Internet Explorer
  function doScrollCheck() {
    if (isReady) return;
    try {
      // If IE is used, use the trick by Diego Perini
      // http://javascript.nwbox.com/IEContentLoaded/
      document.documentElement.doScroll('left');
    } catch (err) {
      setTimeout(doScrollCheck, 0);
      return;
    }
    // and execute any waiting functions
    onDOMReady();
  }

  // Catch cases where called after the browser event has already occurred.
  if (document.readyState !== 'loading') return onDOMReady();

  // Mozilla, Opera and webkit nightlies currently support this event
  if (document.addEventListener) {
    // Use the handy event callback
    document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);
    // A fallback to window.onload, that will always work
    window.addEventListener('load', onDOMContentLoaded, false);
    // If IE event model is used
  } else if (document.attachEvent) {
    // ensure firing before onload,
    // maybe late but safe also for iframes
    document.attachEvent('onreadystatechange', onDOMContentLoaded);
    // A fallback to window.onload, that will always work
    window.attachEvent('onload', onDOMContentLoaded);
    // If IE and not a frame
    // continually check to see if the document is ready
    var toplevel;
    try {
      toplevel = window.frameElement == null;
    } catch (err) {}
    if (document.documentElement.doScroll && toplevel) {
      doScrollCheck();
    }
  }
};

App.prototype._getAppStateScript = function() {
  return document.querySelector('script[data-derby-app-state]');
};

App.prototype.use = util.use;
App.prototype.serverUse = util.serverUse;

App.prototype.loadViews = function() {};

App.prototype.loadStyles = function() {};

// This function is overriden by requiring 'derby/parsing'
App.prototype.addViews = function() {
  throw new Error(
    'Parsing not available. Registering a view from source should not be used ' +
    'in application code. Instead, specify a filename with view.file.'
  );
};

App.prototype.component = function(name, constructor, isDependency) {
  if (typeof name === 'function') {
    constructor = name;
    name = null;
  }
  if (typeof constructor !== 'function') {
    throw new Error('Missing component constructor argument');
  }

  var viewProp = constructor.view;
  var viewIs, viewFilename, viewSource, viewDependencies;
  // Always using an object for the static `view` property is preferred
  if (viewProp && typeof viewProp === 'object') {
    viewIs = viewProp.is;
    viewFilename = viewProp.file;
    viewSource = viewProp.source;
    viewDependencies = viewProp.dependencies;
  } else {
    // Ignore other properties when `view` is an object. It is possible that
    // properties could be inherited from a parent component when extending it.
    //
    // DEPRECATED: constructor.prototype.name and constructor.prototype.view
    // use the equivalent static properties instead
    viewIs = constructor.is || constructor.prototype.name;
    viewFilename = constructor.view || constructor.prototype.view;
  }
  var viewName = name || viewIs ||
    (viewFilename && path.basename(viewFilename, '.html'));

  if (!viewName) {
    throw new Error('No view specified for component');
  }
  if (viewFilename && viewSource) {
    throw new Error('Component may not specify both a view file and source');
  }

  // TODO: DRY. This is copy-pasted from derby-templates
  var mapName = viewName.replace(/:index$/, '');
  var currentView = this.views.nameMap[mapName];
  var currentConstructor = (currentView && currentView.componentFactory) ?
    currentView.componentFactory.constructor :
    this._pendingComponentMap[mapName];

  // Avoid registering the same component twice; we want to avoid the overhead
  // of loading view files from disk again. This is also what prevents
  // circular dependencies from infinite looping
  if (currentConstructor === constructor) return;

  // Calling app.component() overrides existing views or components. Prevent
  // dependencies from doing this without warning
  if (isDependency && currentView && !currentView.fromSerialized) {
    throw new Error('Dependencies cannot override existing views. Already registered "' + viewName + '"');
  }

  // This map is used to prevent infinite loops from circular dependencies
  this._pendingComponentMap[mapName] = constructor;

  // Recursively register component dependencies
  if (viewDependencies) {
    for (var i = 0; i < viewDependencies.length; i++) {
      var dependency = viewDependencies[i];
      if (Array.isArray(dependency)) {
        this.component(dependency[0], dependency[1], true);
      } else {
        this.component(null, dependency, true);
      }
    }
  }

  // Register or find views specified by the component
  var view;
  if (viewFilename) {
    this.loadViews(viewFilename, viewName);
    view = this.views.find(viewName);

  } else if (viewSource) {
    this.addViews(viewSource, viewName);
    view = this.views.find(viewName);

  } else if (name) {
    view = this.views.find(viewName);

  } else {
    view = this.views.register(viewName, '');
  }
  if (!view) {
    var message = this.views.findErrorMessage(viewName);
    throw new Error(message);
  }

  // Inherit from Component
  components.extendComponent(constructor);
  // Associate the appropriate view with the component constructor
  view.componentFactory = components.createFactory(constructor);

  delete this._pendingComponentMap[mapName];

  // Make chainable
  return this;
};

App.prototype.createPage = function() {
  if (this.page) {
    this.emit('destroyPage', this.page);
    this.page.destroy();
  }
  var page = new this.Page(this, this.model);
  this.page = page;
  return page;
};

App.prototype.onRoute = function(callback, page, next, done) {
  if (this._waitForAttach) {
    // Cancel any routing before the initial page attachment. Instead, do a
    // render once derby is ready
    this._cancelAttach = true;
    return;
  }
  this.emit('route', page);
  // HACK: To update render in transitional routes
  page.model.set('$render.params', page.params);
  page.model.set('$render.url', page.params.url);
  page.model.set('$render.query', page.params.query);
  // If transitional
  if (done) {
    var app = this;
    var _done = function() {
      app.emit('routeDone', page, 'transition');
      done();
    };
    callback.call(page, page, page.model, page.params, next, _done);
    return;
  }
  callback.call(page, page, page.model, page.params, next);
};

App.prototype._autoRefresh = function() {
  var app = this;
  var connection = this.model.connection;
  connection.on('connected', function() {
    connection.send({
      derby: 'app',
      name: app.name,
      hash: app.scriptHash
    });
  });
  connection.on('receive', function(request) {
    if (request.data.derby) {
      var message = request.data;
      request.data = null;
      app._handleMessage(message.derby, message);
    }
  });
};

App.prototype._handleMessage = function(action, message) {
  if (action === 'refreshViews') {
    var fn = new Function('return ' + message.views)(); // jshint ignore:line
    fn(derbyTemplates, this.views);
    var ns = this.model.get('$render.ns');
    this.page.render(ns);

  } else if (action === 'refreshStyles') {
    var styleElement = document.querySelector('style[data-filename="' +
      message.filename + '"]');
    if (styleElement) styleElement.innerHTML = message.css;

  } else if (action === 'reload') {
    this.model.whenNothingPending(function() {
      window.location = window.location;
    });
  }
};

App._parseInitialData = function _parseInitialData(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    var message = error.message || '';
    var match = message.match(/Unexpected token (.) in JSON at position (\d+)/);
    if (match) {
      var p = parseInt(match[2], 10);
      var stringContext = jsonString.substring(
        Math.min(0, p - 30),
        Math.max(p + 30, jsonString.length - 1)
      );
      throw new Error('Parse failure: ' + error.message + ' context: \'' + stringContext + '\'');
    }
    throw error;
  }
};
