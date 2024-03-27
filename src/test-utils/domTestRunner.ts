import { util } from 'racer';

import { assertions as registerAssertions } from './assertions';
import { ComponentHarness } from './ComponentHarness';

export class DomTestRunner{
  window?: any;
  document?: any;
  harnesses: ComponentHarness[];

  constructor() {
    this.window = null;
    this.document = null;
    this.harnesses = [];
  }

  installMochaHooks(options) {
    options = options || {};
    const jsdomOptions = options.jsdomOptions;

    // Set up runner's `window` and `document`.
    if (util.isServer) {
      mochaHooksForNode(this, {
        jsdomOptions: jsdomOptions
      });
    } else {
      mochaHooksForBrowser(this);
    }
  }

  createHarness() {
    const harness = new ComponentHarness();
    if (arguments.length > 0) {
      // eslint-disable-next-line prefer-spread, prefer-rest-params
      harness.setup.apply(harness, arguments);
    }
    this.harnesses.push(harness);
    return harness;
  }
}

function mochaHooksForNode(runner, options) {
  const jsdomOptions = options.jsdomOptions;

  // Use an indirect require so that Browserify doesn't try to bundle JSDOM.
  const JSDOM = util.serverRequire(module, 'jsdom').JSDOM;

  const nodeGlobal = global;
  // Keep a direct reference so that we're absolutely sure we clean up our own JSDOM.
  let jsdom;

  global.beforeEach(function() {
    jsdom = new JSDOM('', jsdomOptions);
    runner.window = jsdom.window;
    runner.document = jsdom.window.document;
    // Set `window` and `document` globals for Derby code that doesn't allow injecting them.
    nodeGlobal.window = runner.window;
    nodeGlobal.document = runner.document;
    // Initialize "input" and "change" listeners on the document.
    module.require('../documentListeners').add(runner.document);
  });

  global.afterEach(function() {
    // Destroy the pages created by the harness, so that if a test cleans up its model itself,
    // bindings won't throw errors due to `document` not being present.
    runner.harnesses.forEach(function(harness) {
      harness.app._pages.forEach(function(page) {
        page.destroy();
      });
    });
    runner.harnesses = [];

    jsdom.window.close();
    runner.window = null;
    runner.document = null;
    delete nodeGlobal.window;
    delete nodeGlobal.document;
  });
}

function mochaHooksForBrowser(runner) {
  global.beforeEach(function() {
    runner.window = global.window;
    runner.document = global.window.document;
  });

  global.afterEach(function() {
    runner.window = null;
    runner.document = null;
  });
}

const runner = new DomTestRunner();
// Set up Chai assertion chain methods: `#html` and `#render`
registerAssertions(runner, module.require('chai').Assertion);

export function install(options) {
  runner.installMochaHooks(options);
  return runner;
}
