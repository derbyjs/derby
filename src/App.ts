/*
 * App.js
 *
 * Provides the glue between views, controllers, and routes for an
 * application's functionality. Apps are responsible for creating pages.
 *
 */
import { EventEmitter } from 'events';
import { basename } from 'path';

import { type Model } from 'racer';
import * as util from 'racer/lib/util';
import tracks = require('tracks');

import components = require('./components');
import { type ComponentConstructor } from './components';
import { Page, type PageBase } from './Page';
import * as derbyTemplates from './templates';

const { templates } = derbyTemplates;

// TODO: Change to Map once we officially drop support for ES5.
global.APPS = global.APPS || {};

export function createAppPage(derby): typeof PageBase {
  const pageCtor = ((derby && derby.Page) || Page) as typeof PageBase;
  // Inherit from Page/PageForServer so that we can add controller functions as prototype
  // methods on this app's pages
  class AppPage extends pageCtor { }
  return AppPage;
}

interface AppOptions {
  appMetadata?: Record<string, string>,
  scriptHash?: string,
}

type OnRouteCallback = (arg0: Page, arg1: Page, model: Model, params: any, done?: () => void) => void;

export abstract class AppBase extends EventEmitter {
  derby: any;
  name: string;
  filename: string;
  scriptHash: string;
  // bundledAt: string;
  appMetadata: Record<string, string>;
  Page: typeof PageBase;
  proto: any;
  views: any;
  tracksRoutes: any;
  model: Model;
  page: PageBase;

  constructor(derby, name, filename, options: AppOptions = {}) {
    super();
    this.derby = derby;
    this.name = name;
    this.filename = filename;
    this.scriptHash = options.scriptHash ?? '';
    this.appMetadata = options.appMetadata;
    this.Page = createAppPage(derby);
    this.proto = this.Page.prototype;
    this.views = new templates.Views();
    this.tracksRoutes = tracks.setup(this);
    this.model = null;
    this.page = null;
  }

  abstract _init(options?: AppOptions);
  loadViews(_viewFilename, _viewName) { }
  loadStyles(_filename, _options) { }
}

export class App extends AppBase {
  _pendingComponentMap: any;
  _waitForAttach: boolean;
  _cancelAttach: boolean;
  page: Page;
  history: {
    refresh(): void,
    push(): void,
    replace(): void,
  };

  use = util.use;
  serverUse = util.serverUse;

  constructor(derby, name, filename, options: AppOptions) {
    super(derby, name, filename, options);
    this._pendingComponentMap = {};
    this._init(options);
  }

  // Overriden on server
  _init(_options) {
    this._waitForAttach = true;
    this._cancelAttach = false;
    this.model = new this.derby.Model();
    const serializedViews = this._views();
    serializedViews(derbyTemplates, this.views);
    // Must init async so that app.on('model') listeners can be added.
    // Must also wait for content ready so that bundle is fully downloaded.
    this._contentReady();
  }

  _views() {
    return require('./_views');
  }

  _finishInit() {
    const data = this._getAppData();
    util.isProduction = data.nodeEnv === 'production';

    let previousAppInfo;
    if (!util.isProduction) {
      previousAppInfo = global.APPS[this.name];
      if (previousAppInfo) {
        previousAppInfo.app._destroyCurrentPage();
      }
      global.APPS[this.name] = {
        app: this,
        initialState: data,
      };
    }

    this.model.createConnection(data);
    this.emit('model', this.model);

    if (!util.isProduction) this._autoRefresh();

    this.model.unbundle(data);

    const page = this.createPage();
    page.params = this.model.get('$render.params');
    this.emit('ready', page);

    this._waitForAttach = false;
    // Instead of attaching, do a route and render if a link was clicked before
    // the page finished attaching, or if this is a new app from hot reload.
    if (this._cancelAttach || previousAppInfo) {
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
  }

  _getAppData() {
    const script = this._getAppStateScript();
    if (script) {
      return App._parseInitialData(script.textContent);
    } else {
      return global.APPS[this.name].initialState;
    }
  }

  // Modified from: https://github.com/addyosmani/jquery.parts/blob/master/jquery.documentReady.js
  _contentReady() {
    // Is the DOM ready to be used? Set to true once it occurs.
    let isReady = false;

    // The ready event handler
    function onDOMContentLoaded() {
      if (document.addEventListener) {
        document.removeEventListener('DOMContentLoaded', onDOMContentLoaded, false);
      } else {
        // we're here because readyState !== 'loading' in oldIE
        // which is good enough for us to call the dom ready!
        // @ts-expect-error IE api
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
        this._finishInit();
      }, 0);
    }

    // The DOM ready check for Internet Explorer
    function doScrollCheck() {
      if (isReady) return;
      try {
        // If IE is used, use the trick by Diego Perini
        // http://javascript.nwbox.com/IEContentLoaded/
        // @ts-expect-error IE only api check
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
      // @ts-expect-error IE event model
    } else if (document.attachEvent) {
      // ensure firing before onload,
      // maybe late but safe also for iframes
      // @ts-expect-error IE api
      document.attachEvent('onreadystatechange', onDOMContentLoaded);
      // A fallback to window.onload, that will always work
      // @ts-expect-error `attachEvent` checked above
      window.attachEvent('onload', onDOMContentLoaded);
      // If IE and not a frame
      // continually check to see if the document is ready
      let toplevel;
      try {
        toplevel = window.frameElement == null;
      } catch (err) { /* ignore, not IE */ }
      // @ts-expect-error IE api
      if (document.documentElement.doScroll && toplevel) {
        doScrollCheck();
      }
    }
  }

  _getAppStateScript() {
    return document.querySelector('script[data-derby-app-state]');
  }

  // This function is overriden by requiring 'derby/parsing'
  addViews(_viewFileName: string, _namespace: string) {
    throw new Error(
      'Parsing not available. Registering a view from source should not be used ' +
      'in application code. Instead, specify a filename with view.file.'
    );
  }

  component(name: string, constructor: ComponentConstructor, isDependency: boolean) {
    if (typeof name === 'function') {
      constructor = name;
      name = null;
    }
    if (typeof constructor !== 'function') {
      throw new Error('Missing component constructor argument');
    }

    const viewProp = constructor.view;
    let viewIs, viewFilename, viewSource, viewDependencies;
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
      // @ts-expect-error Ignore deprecated props
      viewIs = constructor.is || constructor.prototype.name;
      viewFilename = constructor.view || constructor.prototype.view;
    }
    const viewName = name || viewIs ||
      (viewFilename && basename(viewFilename, '.html'));

    if (!viewName) {
      throw new Error('No view specified for component');
    }
    if (viewFilename && viewSource) {
      throw new Error('Component may not specify both a view file and source');
    }

    // TODO: DRY. This is copy-pasted from ./templates
    const mapName = viewName.replace(/:index$/, '');
    const currentView = this.views.nameMap[mapName];
    const currentConstructor = (currentView && currentView.componentFactory) ?
      currentView.componentFactory.constructorFn :
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
      for (let i = 0; i < viewDependencies.length; i++) {
        const dependency = viewDependencies[i];
        if (Array.isArray(dependency)) {
          this.component(dependency[0], dependency[1], true);
        } else {
          this.component(null, dependency, true);
        }
      }
    }

    // Register or find views specified by the component
    let view;
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
      const message = this.views.findErrorMessage(viewName);
      throw new Error(message);
    }

    // Inherit from Component
    components.extendComponent(constructor);
    // Associate the appropriate view with the component constructor
    view.componentFactory = components.createFactory(constructor);

    delete this._pendingComponentMap[mapName];

    // Make chainable
    return this;
  }

  createPage() {
    this._destroyCurrentPage();
    const page = new Page(this, this.model);
    this.page = page;
    return page;
  }

  _destroyCurrentPage() {
    if (this.page) {
      this.emit('destroyPage', this.page);
      this.page.destroy();
    }
  }

  onRoute(callback: OnRouteCallback, page: Page, next: () => void, done: () => void) {
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
      const _done = function() {
        this.emit('routeDone', page, 'transition');
        done();
      };
      callback.call(page, page, page.model, page.params, next, _done);
      return;
    }
    callback.call(page, page, page.model, page.params, next);
  }

  _autoRefresh(_backend?: unknown) {
    const connection = this.model.connection;
    connection.on('connected', function() {
      connection.send({
        derby: 'app',
        name: this.name,
        hash: this.scriptHash
      });
    });
    connection.on('receive', function(request) {
      if (request.data.derby) {
        const message = request.data;
        request.data = null;
        this._handleMessage(message.derby, message);
      }
    });
  }

  _handleMessage(action: string, message: { views: string, filename: string, css: string}) {
    if (action === 'refreshViews') {
      const fn = new Function('return ' + message.views)(); // jshint ignore:line
      fn(derbyTemplates, this.views);
      const ns = this.model.get('$render.ns');
      this.page.render(ns);

    } else if (action === 'refreshStyles') {
      const styleElement = document.querySelector('style[data-filename="' +
        message.filename + '"]');
      if (styleElement) styleElement.innerHTML = message.css;

    } else if (action === 'reload') {
      this.model.whenNothingPending(function() {
        const { location } = window;
        window.location = location;
      });
    }
  }

  static _parseInitialData(jsonString: string) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      const message = error.message || '';
      const match = message.match(/^Unexpected token/);
      if (match) {
        const p = parseInt(match[2], 10);
        const stringContext = jsonString.substring(
          Math.min(0, p - 30),
          Math.max(p + 30, jsonString.length - 1)
        );
        throw new Error('Parse failure: ' + error.message + ' context: \'' + stringContext + '\'');
      }
      throw error;
    }
  }
}
