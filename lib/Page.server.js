var Page = require('./Page');
var util = require('racer/lib/util');
var contexts = require('derby-templates').contexts;

Page.prototype.render = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  this.app.emit('render', this);

  if (status) this.res.statusCode = status;
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  this.res.setHeader('Cache-Control', 'no-store');

  this._setRenderParams(ns);
  var pageHtml = (this.app.serverRender) ? this.get('Page', ns) : this.get('BootstrapPage', ns);
  var tailHtml = this.get('Tail', ns);

  var page = this;
  this.model.destroy('$components');
  this.model.bundle(function(err, bundle) {
    if (page.model.hasErrored) return;
    if (err) return page.emit('error', err);
    var scripts = '<script async src="' + page.app.scriptUrl + '"></script>' +
      '<script type="application/json">' + stringifyBundle(bundle) + '</script>';
    page.res.send(pageHtml + scripts + tailHtml);
    page.app.emit('routeDone', page, 'render');
  });
};

Page.prototype.renderStatic = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  this.app.emit('renderStatic', this);

  if (status) this.res.statusCode = status;
  this.params = pageParams(this.req);
  this._setRenderParams(ns);
  var pageHtml = this.get('Page', ns);
  var tailHtml = this.get('Tail', ns);
  this.res.send(pageHtml + tailHtml);
  this.app.emit('routeDone', this, 'renderStatic');
};

// Don't register any listeners on the server
Page.prototype._addListeners = function() {};

function stringifyBundle(bundle) {
  // Pretty the output in development
  var json = (util.isProduction) ?
    JSON.stringify(bundle) :
    JSON.stringify(bundle, null, 2);
  return json && json.replace(/<\//g, '<\\/');
}

// TODO: Cleanup; copied from tracks
function pageParams(req) {
  var params = {
    url: req.url
  , body: req.body
  , query: req.query
  };
  for (var key in req.params) {
    params[key] = req.params[key];
  }
  return params;
}
