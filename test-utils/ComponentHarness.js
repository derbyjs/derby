var qs = require('qs');
var urlParse = require('url').parse;
var Model = require('racer').Model;
var App = require('../lib/App');
var AppForServer = require('../lib/AppForServer');

function AppForHarness(harness) {
  App.call(this);
  this._harness = harness;
}
AppForHarness.prototype = Object.create(App.prototype);
AppForHarness.prototype.constructor = AppForHarness;

AppForHarness.prototype.createPage = function() {
  return new this.Page(this, this._harness.model);
};

// Load views by filename. The client version of this method is a no-op
AppForHarness.prototype.loadViews = AppForServer.prototype.loadViews;

// `_init()` does setup for loading views from files on the server and loading
// serialized views and data on the client
AppForHarness.prototype._init = function() {
  this._initLoad();
};
// Register default compilers so that AppForHarness can load views & styles from
// the filesystem
AppForHarness.prototype._initLoad = AppForServer.prototype._initLoad;


module.exports = ComponentHarness;
/**
 * Creates a `ComponentHarness`.
 *
 * If arguments are provided, then `#setup` is called with the arguments.
 */
function ComponentHarness() {
  this.app = new AppForHarness(this);
  this.model = new Model();

  if (arguments.length > 0) {
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
ComponentHarness.prototype.setup = function(source) {
  this.app.views.register('$harness', source);
  // Remaining variable arguments are components
  for (var i = 1; i < arguments.length; i++) {
    var constructor = arguments[i];
    this.app.component(constructor);
  }
  return this;
};

/**
 * Stubs out view names with empty views.
 *
 * A view name is a colon-separated string of segments, as used in `<view is="...">`.
 *
 * @example
 *   var harness = new ComponentHarness('<view is="dialog"/>', Dialog)
 *     .stub('icons:open-icon', 'icons:close-icon');
 */
ComponentHarness.prototype.stub = function() {
  for (var i = 0; i < arguments.length; i++) {
    var name = arguments[i];
    this.app.views.register(name, '');
  }
  return this;
};

/**
 * Stubs out view names as components.
 *
 * This can be used to test the values being bound to ("passed into") child components.
 *
 * @example
 *   var harness = new ComponentHarness('<view is="dialog"/>', Dialog)
 *     .stubComponent('common:file-picker', {is: 'footer', as: 'stubFooter'});
 */
ComponentHarness.prototype.stubComponent = function() {
  for (var i = 0; i < arguments.length; i++) {
    var arg = arguments[i];
    var options = (typeof arg === 'string') ? {is: arg} : arg;
    var Stub = createStubComponent(options);
    this.app.component(Stub);
  }
  return this;
};

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
ComponentHarness.prototype.renderHtml = function(options) {
  return this._get(function(page) {
    page.html = page.get('$harness');
  }, options);
};
/**
 * Renders the harness into a `DocumentFragment`, as client-side rendering would do.
 *
 * @param {RenderOptions} [options]
 * @returns { Page & {fragment: DocumentFragment} } a `Page` that has a `fragment` property with the
 *   rendered `DocumentFragment`
 */
ComponentHarness.prototype.renderDom = function(options) {
  return this._get(function(page) {
    page.fragment = page.getFragment('$harness');
  }, options);
};

ComponentHarness.prototype.attachTo = function(parentNode, node) {
  return this._get(function(page) {
    var view = page.getView('$harness');
    var targetNode = node || parentNode.firstChild;
    view.attachTo(parentNode, targetNode, page.context);
  });
};

/**
 * @param {(page: Page) => void} render
 * @param {RenderOptions} [options]
 */
ComponentHarness.prototype._get = function(render, options) {
  options = options || {};
  var url = options.url || '';

  var page = this.app.createPage();
  // Set `page.params`, which is usually created in tracks during `Page#render`:
  // https://github.com/derbyjs/tracks/blob/master/lib/index.js
  page.params = {
    url: url,
    query: qs.parse(urlParse(url).query),
    body: {},
  };

  render(page);
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
};
ComponentHarness.createStubComponent = createStubComponent;

function createStubComponent(options) {
  var as = options.as || options.is;
  var asArray = options.asArray;

  function StubComponent() {}
  StubComponent.view = {
    is: options.is,
    file: options.file,
    source: options.source,
    dependencies: options.dependencies
  };
  StubComponent.prototype.init = (asArray) ?
    function() {
      var page = this.page;
      var component = this;
      if (page[asArray]) {
        page[asArray].push(this);
      } else {
        page[asArray] = [this];
      }
      this.on('destroy', function() {
        var index = page[asArray].indexOf(component);
        if (index === -1) return;
        page[asArray].splice(index, 1);
      });
    } :
    function() {
      var page = this.page;
      page[as] = this;
      this.on('destroy', function() {
        page[as] = undefined;
      });
    };
  return StubComponent;
}
