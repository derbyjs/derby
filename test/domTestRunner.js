var registerAssertions = require('../test-utils/assertions');
var ComponentHarness = require('../test-utils/ComponentHarness');

exports.createRunner = function createRunner() {
  var runner = new DomTestRunner();
  // Set up Chai assertion chain methods: `#html` and `#render`
  registerAssertions(runner, require('chai').Assertion);

  beforeEach(function() {
    runner.harness = new ComponentHarness();
  });

  // Set up runner's `window` and `document`.
  if (process && process.argv && process.argv.length) {
    mochaHooksForNode(runner);
  } else {
    mochaHooksForBrowser(runner);
  }

  return runner;
};

function DomTestRunner() {
  this.harness = null;
  this.window = null;
  this.document = null;
}

function mochaHooksForNode(runner) {
  // Use an indirect require so that Browserify doesn't try to bundle JSDOM.
  var JSDOM = require('racer').util.serverRequire(module, 'jsdom').JSDOM;

  var nodeGlobal = global;
  // Keep a direct reference so that we're absolutely sure we clean up our own JSDOM.
  var jsdom;

  beforeEach(function() {
    jsdom = new JSDOM();
    runner.window = jsdom.window;
    runner.document = jsdom.window.document;
    // Set `window` and `document` globals for Derby code that doesn't allow injecting them.
    nodeGlobal.window = runner.window;
    nodeGlobal.document = runner.document;
    // Initialize "input" and "change" listeners on the document.
    require('../lib/documentListeners').add(runner.document);
  });

  afterEach(function() {
    jsdom.window.close();
    delete nodeGlobal.window;
    delete nodeGlobal.document;
  });
}

function mochaHooksForBrowser(runner) {
  beforeEach(function() {
    runner.window = global.window;
    runner.document = global.window.document;
  });
}
