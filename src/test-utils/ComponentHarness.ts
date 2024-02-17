import { EventEmitter } from 'events';
import { parse as urlParse } from 'url';

import * as qs from 'qs';
import { RootModel } from 'racer';

import { instance as derby } from '..';
import { App } from '../App';
import { AppForServer } from '../AppForServer';
import { Component, ComponentConstructor } from '../components';
import { PageBase, PageForClient } from '../Page';

class PageForHarness extends PageForClient {
  component?: Component;
  fragment?: any;
  html?: any;
}

class AppForHarness extends App {
  _harness: any;
  _pages: PageForHarness[];
  page: PageForHarness;
  Page = PageForHarness;

  constructor(harness) {
    super(derby, 'ComponentHarness_App', '', {});
    this._harness = harness;
    this._pages = [];
  }

  createPage(): PageForHarness {
    const page = new PageForHarness(this, this._harness.model);
    this._pages.push(page);
    return page;
  }

  // Load views by filename. The client version of this method is a no-op
  loadViews(...args) {
    AppForServer.prototype.loadViews.call(this, ...args);
  }

  // `_init()` does setup for loading views from files on the server and loading
  // serialized views and data on the client
  _init() {
    this._initLoad();
  }

  // Register default compilers so that AppForHarness can load views & styles from
  // the filesystem
  _initLoad() {
    AppForServer.prototype._initLoad.call(this);
  } 
}

/**
 * Creates a `ComponentHarness`.
 *
 * If arguments are provided, then `#setup` is called with the arguments.
 */
export class ComponentHarness extends EventEmitter {
  app: AppForHarness;
  page: PageForHarness;
  model: RootModel;
  
  constructor() {
    super();
    this.app = new AppForHarness(this);
    this.model = new RootModel();
  
    if (arguments.length > 0) {
      // eslint-disable-next-line prefer-spread, prefer-rest-params
      this.setup.apply(this, arguments);
    }
  }

  /** @typedef { {view: {is: string, source?: string}} } InlineComponent */
  /**
 * Sets up the harness with a HTML template, which should contain a `<view is="..."/>` for the
 * component under test, and the components to register for the test.
 *
 * @param {string} source - HTML template for the harness page
 * @param {...(Component | InlineComponent} components - components to register for the test
 *
 * @example
 *   var harness = new ComponentHarness().setup('<view is="dialog"/>', Dialog);
 */
  setup(source: string, ...components: ComponentConstructor[]) {
    this.app.views.register('$harness', source);
    // Remaining variable arguments are components
    components.forEach(constructor => this.app.component(constructor));
    return this;
  }
  
  /**
   * Stubs out view names with empty view or the provided source.
   *
   * A view name is a colon-separated string of segments, as used in `<view is="...">`.
   *
   * @example
   *   var harness = new ComponentHarness('<view is="dialog"/>', Dialog).stub(
   *     'icons:open-icon',
   *     'icons:close-icon',
   *     {is: 'dialog:buttons', source: '<button>OK</button>'}
   *   );
   */
  stub() {
    for (let i = 0; i < arguments.length; i++) {
      // eslint-disable-next-line prefer-rest-params
      const arg = arguments[i];
      if (typeof arg === 'string') {
        this.app.views.register(arg, '');
      } else if (arg && arg.is) {
        this.app.views.register(arg.is, arg.source || '');
      } else {
        throw new Error('each argument must be the name of a view or an object with an `is` property');
      }
    }
    return this;
  }

  /**
   * Stubs out view names as components.
   *
   * This can be used to test the values being bound to ("passed into") child components.
   *
   * @example
   *   var harness = new ComponentHarness('<view is="dialog"/>', Dialog)
   *     .stubComponent('common:file-picker', {is: 'footer', as: 'stubFooter'});
   */
  stubComponent() {
    for (let i = 0; i < arguments.length; i++) {
      // eslint-disable-next-line prefer-rest-params
      const arg = arguments[i];
      const options = (typeof arg === 'string') ? {is: arg} : arg;
      const Stub = createStubComponent(options);
      this.app.component(Stub);
    }
    return this;
  }
  
  /**
   * @typedef {Object} RenderOptions
   * @property {string} [url] - Optional URL for the render, used to populate `page.params`
   */
  /**
   * Renders the harness into a HTML string, as server-side rendering would do.
   *
   * @param {RenderOptions} [options]
   * @returns { Page & {html: string} } - a `Page` that has a `html` property with the rendered HTML
   *   string
   */
  renderHtml(options) {
    return this._get(function(page) {
      page.html = page.get('$harness');
    }, options);
  }
  
  /**
   * Renders the harness into a `DocumentFragment`, as client-side rendering would do.
   *
   * @param {RenderOptions} [options]
   * @returns { Page & {fragment: DocumentFragment} } a `Page` that has a `fragment` property with the
   *   rendered `DocumentFragment`
   */
  renderDom(options) {
    return this._get(function(page) {
      page.fragment = page.getFragment('$harness');
    }, options);
  }
  
  attachTo(parentNode, node) {
    return this._get(function(page) {
      const view = page.getView('$harness');
      const targetNode = node || parentNode.firstChild;
      view.attachTo(parentNode, targetNode, page.context);
    });
  }
  
  /**
   * @param {(page: PageForHarness) => void} render
   * @param {RenderOptions} [options]
   */
  _get(renderFn: (page: PageForHarness) => void, options?): PageForHarness {
    options = options || {};
    const url = options.url || '';
  
    const page = this.app.createPage();
    // Set `page.params`, which is usually created in tracks during `Page#render`:
    // https://github.com/derbyjs/tracks/blob/master/lib/index.js
    function setPageUrl(url) {
      page.params = {
        url: url,
        query: qs.parse(urlParse(url).query),
        // @ts-expect-error 'body' does not exist in type 'Readonly<PageParams>'
        body: {},
      };
      // Set "$render.params", "$render.query", "$render.url" based on `page.params`.
      page._setRenderParams();
    }
    setPageUrl(url);
    // Fake some methods from tracks/lib/History.js.
    // JSDOM doesn't really support updating the window URL, but this should work for Derby code that
    // pulls URL info from the model or page.
    this.app.history = { push: setPageUrl, replace: setPageUrl, refresh: () => {} };
  
    // The `#render` assertion in assertions.js wants to compare the results of HTML and DOM
    // rendering, to make sure they match. However, component `create()` methods can modify the DOM
    // immediately after initial rendering, which can break assertions.
    //
    // To get around this, we trigger a "pageRendered" event on the harness before `create()` methods
    // get called. This is done by pausing the context, which prevents create() methods from getting
    // called until the pause-count drops to 0.
    page.context.pause();
    renderFn(page);
    this.emit('pageRendered', page);
    page.context.unpause();
  
    // HACK: Implement getting an instance as a side-effect of rendering. This
    // code relies on the fact that while rendering, components are instantiated,
    // and a reference is kept on page._components. Since we just created the
    // page, we can reliably return the first component.
    //
    // The more standard means for getting a reference to a component controller
    // would be to add a hooks in the view with `as=` or `on-init=`. However, we
    // want the developer to pass this view in, so they can supply whatever
    // harness context they like.
    //
    // This may need to be updated if the internal workings of Derby change.
    page.component = page._components._1;
    return page;
  }

  static createStubComponent(options) {
    return createStubComponent(options);
  }
}

function createStubComponent(options) {
  const as = options.as || options.is;
  const asArray = options.asArray;

  class StubComponent extends Component {
    static view = {
      is: options.is,
      file: options.file,
      source: options.source,
      dependencies: options.dependencies
    };

    init() {
      if (asArray) {
        pageArrayInit.call(this);
      } else {
        pageInit.call(this);
      }
    }
  }

  function pageArrayInit() {
    const page = this.page;
    if (page[asArray]) {
      page[asArray].push(this);
    } else {
      page[asArray] = [this];
    }
    this.on('destroy', () => {
      const index = page[asArray].indexOf(this);
      if (index === -1) return;
      page[asArray].splice(index, 1);
    });
  }

  function pageInit() {
    const page = this.page;
    page[as] = this;
    this.on('destroy', function() {
      page[as] = undefined;
    });
  }
  
  return (StubComponent as unknown) as ComponentConstructor;
}
