var tracks = require('tracks');
var util = require('racer/lib/util');
var Views = require('./Views');
var Page = require('./Page');

module.exports = App;

function App(derby, appModule) {
  this.derby = derby;
  this.module = appModule;
  this.views = new Views();
  this.routes = tracks.setup(this);
  if (appModule) appModule.exports = this;
  this._init();
}

App.prototype._init = function() {};

App.prototype.use = util.use;

App.prototype.createPage = function() {
  return new Page(this);
};

util.serverRequire(__dirname + '/App.server');
