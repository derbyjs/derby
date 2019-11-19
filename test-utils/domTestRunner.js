var util = require('racer').util;
var registerAssertions = require('./assertions');
var ComponentHarness = require('./ComponentHarness');

exports.createRunner = function createRunner() {
  var runner = new DomTestRunner();

  runner.installMochaHooks();

  // Set up Chai assertion chain methods: `#html` and `#render`
  registerAssertions(runner, require('chai').Assertion);

  return runner;
};

exports.DomTestRunner = DomTestRunner;
function DomTestRunner() {
  this.window = null;
  this.document = null;
}

DomTestRunner.prototype.installMochaHooks = function() {
  var _this = this;

  // Set up runner's `window` and `document`.
  if (util.isServer) {
    mochaHooksForNode(_this);
  } else {
    mochaHooksForBrowser(_this);
  }
};

DomTestRunner.prototype.createHarness = function() {
  return new ComponentHarness();
};

function mochaHooksForNode(runner) {
  // Use an indirect require so that Browserify doesn't try to bundle JSDOM.
  var JSDOM = util.serverRequire(module, 'jsdom').JSDOM;

  var nodeGlobal = global;
  // Keep a direct reference so that we're absolutely sure we clean up our own JSDOM.
  var jsdom;

  global.beforeEach(function() {
    jsdom = new JSDOM();
    runner.window = jsdom.window;
    runner.document = jsdom.window.document;
    // Set `window` and `document` globals for Derby code that doesn't allow injecting them.
    nodeGlobal.window = runner.window;
    nodeGlobal.document = runner.document;
    // Initialize "input" and "change" listeners on the document.
    require('../lib/documentListeners').add(runner.document);
  });

  global.afterEach(function() {
    jsdom.window.close();
    delete nodeGlobal.window;
    delete nodeGlobal.document;
  });
}

function mochaHooksForBrowser(runner) {
  global.beforeEach(function() {
    runner.window = global.window;
    runner.document = global.window.document;
  });
}
