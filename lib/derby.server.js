var Derby = require('./Derby');
var http = require('http');
var derbyCluster = require('./cluster');

Derby.prototype.run = function(server, port, cb) {
  if (port == null) {
    port = process.env.PORT || (this.util.isProduction ? 80 : 3000);
  }
  function listenCallback(err) {
    console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
    cb && cb(err);
  }
  function createServer() {
    if (typeof server === 'string') server = require(server);
    if (typeof server === 'function') server = http.createServer(server);
    server.listen(port, listenCallback);
  }
  if (this.util.isProduction) return createServer();
  derbyCluster.run(createServer);
};

function createApp(appModule) {
  function Page(model, res) {
    this.model = model;
    this.view = view;
    this._res = res;
    this._viewModels = [];
  }
  Page.prototype.render = function(ns, ctx, status) {
    this._res._derbyViewModels = this._viewModels;
    view.render(this._res, this.model, ns, ctx, status);
  };
  Page.prototype.init = viewModel.pageInit;

  function createPage(req, res) {
    var model = req.getModel();
    app.emit('model', model);
    return new Page(model, res);
  }
  
  app.routes = tracks.setup(app, createPage, onRoute);
}
