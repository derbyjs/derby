var Views = require('./Views');
var Page = require('./Page');

module.exports = App;

function App(derby) {
  this.derby = derby;
  this.views = new Views();
}

App.prototype.createPage = function() {
  return new Page(this);
};
