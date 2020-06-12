var util = require('racer').util;
var registerAssertions = require('./assertions');
var ComponentHarness = require('./ComponentHarness');

var runner = new DomTestRunner();
// Set up Chai assertion chain methods: `#html` and `#render`
registerAssertions(runner, require('chai').Assertion);

exports.install = function(options) {
  runner.installMochaHooks(options);
  return runner;
};

exports.DomTestRunner = DomTestRunner;
function DomTestRunner() {
  this.window = null;
  this.document = null;
}

DomTestRunner.prototype.installMochaHooks = function(options) {
  options = options || {};
  var jsdomOptions = options.jsdomOptions;

  // Set up runner's `window` and `document`.
  if (util.isServer) {
    mochaHooksForNode(this, {
      jsdomOptions: jsdomOptions
    });
  } else {
    mochaHooksForBrowser(this);
  }
};

DomTestRunner.prototype.createHarness = function() {
  var harness = new ComponentHarness();
  if (arguments.length > 0) {
    harness.setup.apply(harness, arguments);
  }
  runner._harness = harness;
  return harness;
};

function mochaHooksForNode(runner, options) {
  var jsdomOptions = options.jsdomOptions;

  // Use an indirect require so that Browserify doesn't try to bundle JSDOM.
  var JSDOM = util.serverRequire(module, 'jsdom').JSDOM;

  var nodeGlobal = global;
  // Keep a direct reference so that we're absolutely sure we clean up our own JSDOM.
  var jsdom;

  global.beforeEach(function() {
    jsdom = new JSDOM('', jsdomOptions);
    runner.window = jsdom.window;
    runner.document = jsdom.window.document;
    // Set `window` and `document` globals for Derby code that doesn't allow injecting them.
    nodeGlobal.window = runner.window;
    nodeGlobal.document = runner.document;
    // Initialize "input" and "change" listeners on the document.
    require('../lib/documentListeners').add(runner.document);
  });

  global.afterEach(function() {
    // Destroy the pages created by the harness, so that if a test cleans up its model itself,
    // bindings won't throw errors due to `document` not being present.
    if (runner._harness) {
      runner._harness.app.pages.forEach(function(page) {
        page.destroy();
      });
    }
    runner._harness = null;

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
