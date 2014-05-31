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

  var start = Date.now()
  this._setRenderParams(ns);
  var pageHtml = this.get('Page', ns);
  var tailHtml = this.get('Tail', ns);

  var page = this;
  this.model.destroy('$components');
  this.model.bundle(function(err, bundle) {
    if (err) return page.emit('error', err);
    var scripts = '<script async src="' + page.app.scriptUrl + '"></script>' +
      '<script type="application/json">' + stringifyBundle(bundle) + '</script>';
    page.res.send(pageHtml + scripts + tailHtml);
    page.routing = false;
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
  this._setRenderParams(ns);
  var pageHtml = this.get('Page', ns);
  var tailHtml = this.get('Tail', ns);
  this.res.send(pageHtml + tailHtml);
  this.routing = false;
  this.app.emit('routeDone', this, 'renderStatic');
};

// Don't register any listeners on the server
Page.prototype._addListeners = function() {};

function stringifyBundle(bundle) {
  // Pretty the output in development
  var json = (util.isProduction) ?
    JSON.stringify(bundle) :
    JSON.stringify(bundle, null, 2);
  return json && json.replace(/<\/script/gi, '\</script');
}
