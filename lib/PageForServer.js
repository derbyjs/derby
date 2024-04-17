var Page = require('./Page');

module.exports = PageForServer;
function PageForServer(app, model, req, res) {
  Page.call(this, app, model);
  this.req = req;
  this.res = res;
}

PageForServer.prototype = Object.create(Page.prototype);
PageForServer.prototype.constructor = PageForServer;

PageForServer.prototype.render = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  this.app.emit('render', this);

  if (status) this.res.statusCode = status;
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  this.res.setHeader('Cache-Control', 'no-store');
  // Set HTML utf-8 content type unless already set
  if (!this.res.getHeader('Content-Type')) {
    this.res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }

  this._setRenderParams(ns);
  var pageHtml = this.get('Page', ns);
  this.res.write(pageHtml);
  this.app.emit('htmlDone', this);

  this.res.write('<script data-derby-app-state type="application/json">');
  var tailHtml = this.get('Tail', ns);

  this.model.destroy('$components');

  var page = this;
  this.model.bundle(function(err, bundle) {
    if (page.model.hasErrored) return;
    if (err) return page.emit('error', err);
    var json = stringifyBundle(bundle);
    page.res.write(json);
    page.res.end('</script>' + tailHtml);
    page.app.emit('routeDone', page, 'render');
  });
};

PageForServer.prototype.renderStatic = function(status, ns) {
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
PageForServer.prototype._addListeners = function() {};

function stringifyBundle(bundle) {
  var json = JSON.stringify(bundle);
  return json.replace(/<[\/!]/g, function(match) {
    // Replace the end tag sequence with an equivalent JSON string to make
    // sure the script is not prematurely closed
    if (match === '</') return '<\\/';
    // Replace the start of an HTML comment tag sequence with an equivalent
    // JSON string
    if (match === '<!') return '<\\u0021';
    throw new Error('Unexpected match when escaping JSON');
  });
}

// TODO: Cleanup; copied from tracks
function pageParams(req) {
  var params = Object.create(null, {
    url: req.url,
    body: req.body,
    query: req.query,
  });
  for (var key in req.params) {
    params[key] = req.params[key];
  }
  return params;
}
