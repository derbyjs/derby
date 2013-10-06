var Derby = require('./Derby');
var http = require('http');
var derbyCluster = require('./cluster');

// Include template and expression parsing
require('./parsing');

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

// function createStatic(root) {
//   return new Static(root, this._libraries);
// }

// function Static(root, libraries) {
//   this.root = root;
//   this.libraries = libraries;
//   this.views = {};
//   this.fns = {};
// }
// Static.prototype.render = function(name, res, model, ns, ctx, status) {
//   var view = this.views[name];
//   if (!view) {
//     view = this.views[name] = new View(this.libraries);
//     view._root = this.root;
//     view._clientName = name;
//     for (var key in this.fns) {
//       view.fn(key, this.fns[key]);
//     }
//   }
//   view.render(res, model, ns, ctx, status, true);
// };
// Static.prototype.fn = function(name, value) {
//   this.fns[name] = value;
// };
