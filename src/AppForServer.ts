/*
 * App.server.js
 *
 * Application level functionality that is
 * only applicable to the server.
 *
 */

import racer = require('racer');

const util = racer.util;
import { AppBase } from './App';
import { PageForServer } from './PageForServer';
import parsing = require('./parsing');
import * as derbyTemplates from './templates';

interface Agent {
  send(message: Record<string, unknown>): void;
}

// Avoid Browserifying these dependencies
let chokidar, files, fs, path;
if (module.require) {
  chokidar = module.require('chokidar');
  files = module.require('./files');
  fs = module.require('fs');
  path = module.require('path');
}

const STYLE_EXTENSIONS = ['.css'];
const VIEW_EXTENSIONS = ['.html'];
const COMPILERS = {
  '.css': cssCompiler,
  '.html': htmlCompiler
};

function cssCompiler(file, filename, _options) {
  return { css: file, files: [filename] };
}

function htmlCompiler(file) {
  return file;
}

type CompilerFunciton = (file: string, filename?: string, options?: unknown) => unknown;

function watchOnce(filenames, callback) {
  const watcher = chokidar.watch(filenames);
  let closed = false;
  watcher.on('change', function() {
    if (closed) return;
    closed = true;
    // HACK: chokidar 3.1.1 crashes when you synchronously call close
    // in the change event. Delaying appears to prevent the crash
    process.nextTick(function() {
      watcher.close();
    });
    callback();
  });
}

export class AppForServer<T = object> extends AppBase<T> {
  agents: Record<string, Agent>;
  compilers: Record<string, CompilerFunciton>;
  scriptBaseUrl: string;
  scriptCrossOrigin: boolean;
  scriptFilename: string;
  scriptMapBaseUrl: string;
  scriptMapFilename: string;
  scriptMapUrl: string;
  scriptUrl: string;
  serializedBase: string;
  serializedDir: string;
  styleExtensions: string[];
  viewExtensions: string[];
  watchFiles: boolean;
  router: any;

  constructor(derby, name: string, filename: string, options) {
    super(derby, name, filename, options);
    this._init(options);
  }

  _init(options) {
    this._initBundle(options);
    this._initRefresh();
    this._initLoad();
    this._initViews();
  }

  private _initBundle(options) {
    this.scriptFilename = null;
    this.scriptMapFilename = null;
    this.scriptBaseUrl = (options && options.scriptBaseUrl) || '';
    this.scriptMapBaseUrl = (options && options.scriptMapBaseUrl) || '';
    this.scriptCrossOrigin = (options && options.scriptCrossOrigin) || false;
    this.scriptUrl = null;
    this.scriptMapUrl = null;
  }

  private _initRefresh() {
    this.watchFiles = !util.isProduction;
    this.agents = null;
  }

  private _initLoad() {
    this.styleExtensions = STYLE_EXTENSIONS.slice();
    this.viewExtensions = VIEW_EXTENSIONS.slice();
    this.compilers = util.copyObject(COMPILERS);
  }
  
  private _initViews() {
    this.serializedDir = path.dirname(this.filename || '') + '/derby-serialized';
    this.serializedBase = this.serializedDir + '/' + this.name;
    if (fs.existsSync(this.serializedBase + '.json')) {
      this.deserialize();
      this.loadViews = function(_filename, _namespace) { return this; };
      this.loadStyles = function(_filename, _options) { return this; };
      return;
    }

    this.views.register('Page',
      '<!DOCTYPE html>' +
      '<meta charset="utf-8">' +
      '<view is="{{$render.prefix}}TitleElement"></view>' +
      '<view is="{{$render.prefix}}Styles"></view>' +
      '<view is="{{$render.prefix}}Head"></view>' +
      '<view is="{{$render.prefix}}BodyElement"></view>',
      { serverOnly: true }
    );
    this.views.register('TitleElement',
      '<title><view is="{{$render.prefix}}Title"></view></title>'
    );
    this.views.register('BodyElement',
      '<body class="{{$bodyClass($render.ns)}}">' +
      '<view is="{{$render.prefix}}Body"></view>'
    );
    this.views.register('Title', 'Derby App');
    this.views.register('Styles', '', { serverOnly: true });
    this.views.register('Head', '', { serverOnly: true });
    this.views.register('Body', '');
    this.views.register('Tail', '');
  }

  // overload w different signatures, but different use cases
  createPage(req, res, next) {
    const model = req.model || new racer.Model();
    this.emit('model', model);

    const Page = this.Page as unknown as typeof PageForServer;
    const page = new Page(this, model, req, res);
    if (next) {
      model.on('error', function(err) {
        model.hasErrored = true;
        next(err);
      });
      page.on('error', next);
    }
    return page;
  }

  bundle(_backend, _options, _cb) {
    throw new Error(
      'bundle implementation missing; use racer-bundler for implementation, or remove call to this method and use another bundler',
    );
  }

  writeScripts(_backend, _dir, _options, _cb) {
    throw new Error(
      'writeScripts implementation missing; use racer-bundler for implementation, or remove call to this method and use another bundler',
    );
  }

  private _viewsSource(options?) {
    return `/*DERBY_SERIALIZED_VIEWS ${this.name}*/\n` +
      'module.exports = ' + this.views.serialize(options) + ';\n' +
      `/*DERBY_SERIALIZED_VIEWS_END ${this.name}*/\n`;
  }

  serialize() {
    if (!fs.existsSync(this.serializedDir)) {
      fs.mkdirSync(this.serializedDir);
    }
    // Don't minify the views (which doesn't include template source), since this
    // is for use on the server
    const viewsSource = this._viewsSource({ server: true, minify: true });
    fs.writeFileSync(this.serializedBase + '.views.js', viewsSource, 'utf8');
    const scriptUrl = (this.scriptUrl.indexOf(this.scriptBaseUrl) === 0) ?
      this.scriptUrl.slice(this.scriptBaseUrl.length) :
      this.scriptUrl;
    const scriptMapUrl = (this.scriptMapUrl.indexOf(this.scriptMapBaseUrl) === 0) ?
      this.scriptMapUrl.slice(this.scriptMapBaseUrl.length) :
      this.scriptMapUrl;
    const serialized = JSON.stringify({
      scriptBaseUrl: this.scriptBaseUrl,
      scriptMapBaseUrl: this.scriptMapBaseUrl,
      scriptUrl: scriptUrl,
      scriptMapUrl: scriptMapUrl
    });
    fs.writeFileSync(this.serializedBase + '.json', serialized, 'utf8');
  }

  deserialize() {
    const serializedViews = module.require(this.serializedBase + '.views.js');
    const serialized = module.require(this.serializedBase + '.json');
    serializedViews(derbyTemplates, this.views);
    this.scriptUrl = (this.scriptBaseUrl || serialized.scriptBaseUrl) + serialized.scriptUrl;
    this.scriptMapUrl = (this.scriptMapBaseUrl || serialized.scriptMapBaseUrl) + serialized.scriptMapUrl;
  }

  loadViews(filename, namespace) {
    const data = files.loadViewsSync(this, filename, namespace);
    parsing.registerParsedViews(this, data.views);
    if (this.watchFiles) this._watchViews(data.files, filename, namespace);
    // Make chainable
    return this;
  }

  loadStyles(filename, options) {
    this._loadStyles(filename, options);
    const stylesView = this.views.find('Styles');
    stylesView.source += '<view is="' + filename + '"></view>';
    // Make chainable
    return this;
  }

  private _loadStyles(filename, options) {
    const styles = files.loadStylesSync(this, filename, options);

    let filepath = '';
    if (this.watchFiles) {
      /**
       * Mark the path to file as an attribute
       * Used in development to add event watchers and autorefreshing of styles
       * SEE: local file, method this._watchStyles
       * SEE: file ./App.js, method App._autoRefresh()
       */
      filepath = ' data-filename="' + filename + '"';
    }
    const source = '<style' + filepath + '>' + styles.css + '</style>';

    this.views.register(filename, source, {
      serverOnly: true
    });

    if (this.watchFiles) {
      this._watchStyles(styles.files, filename, options);
    }

    return styles;
  }

  private _watchViews(filenames, filename, namespace) {
    watchOnce(filenames, () => {
      this.loadViews(filename, namespace);
      this._updateScriptViews();
      this._refreshClients();
    });
  }

  private _watchStyles(filenames, filename, options) {
    watchOnce(filenames, () => {
      const styles = this._loadStyles(filename, options);
      this._updateScriptViews();
      this._refreshStyles(filename, styles);
    });
  }

  private _watchBundle(filenames) {
    if (!process.send) return;
    watchOnce(filenames, function() {
      process.send({ type: 'reload' });
    });
  }


  private _updateScriptViews() {
    if (!this.scriptFilename) return;
    const script = fs.readFileSync(this.scriptFilename, 'utf8');
    const startIndex = script.indexOf('/*DERBY_SERIALIZED_VIEWS*/');
    const before = script.slice(0, startIndex);
    const endIndex = script.indexOf('/*DERBY_SERIALIZED_VIEWS_END*/');
    const after = script.slice(endIndex + 30);
    const viewsSource = this._viewsSource();
    fs.writeFileSync(this.scriptFilename, before + viewsSource + after, 'utf8');
  }

  private _autoRefresh(backend) {
    // already been setup if agents is defined
    if (this.agents) return;
    this.agents = {};

    // Auto-refresh is implemented on top of ShareDB's messaging layer.
    //
    // However, ShareDB wasn't originally designed to support custom message types, so ShareDB's
    // Agent class will log out "Invalid or unknown message" warnings if it encounters a message
    // it doesn't recognize.
    //
    // A workaround is to register a "receive" middleware, which fires when a ShareDB server
    // receives a message from a client. If the message is Derby-related, the middleware will
    // "exit" the middleware chain early by not calling `next()`. That way, the custom message never
    // gets to the ShareDB Agent and won't result in warnings.
    //
    // However, multiple Derby apps can run together on the same ShareDB backend, each adding a
    // "receive" middleware, and they all need to be notified of incoming Derby messages. This
    // solution combines the exit-early approach with a custom event to accomplish that.
    backend.use('receive', function(request, next) {
      const data = request.data;
      if (data.derby) {
        // Derby-related message, emit custom event and "exit" middleware chain early.
        backend.emit('derby:_messageReceived', request.agent, data.derby, data);
        return;
      } else {
        // Not a Derby-related message, pass to next middleware.
        next();
      }
    });

    backend.on('derby:_messageReceived', (agent, action, message) => {
      this._handleMessageServer(agent, action, message);
    });
  }

  private _handleMessageServer(agent, action, message) {
    if (action === 'app') {
      if (message.name !== this.name) {
        return;
      }
      if (message.hash !== this.scriptHash) {
        return agent.send({ derby: 'reload' });
      }
      this._addAgent(agent);
    }
  }

  private _addAgent(agent) {
    this.agents[agent.clientId] = agent;
    agent.stream.once('end', () => {
      delete this.agents[agent.clientId];
    });
  }

  private _refreshClients() {
    if (!this.agents) return;
    const views = this.views.serialize({ minify: true });
    const message = {
      derby: 'refreshViews',
      views: views
    };
    for (const id in this.agents) {
      this.agents[id].send(message);
    }
  }

  private _refreshStyles(filename, styles) {
    if (!this.agents) return;
    const message = {
      derby: 'refreshStyles',
      filename: filename,
      css: styles.css
    };
    for (const id in this.agents) {
      this.agents[id].send(message);
    }
  }

  middleware(backend) {
    return [backend.modelMiddware(), this.router()];
  }

  initAutoRefresh(backend) {
    this._autoRefresh(backend);
  }
}
