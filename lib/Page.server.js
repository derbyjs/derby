var Page = require('./Page');
var util = require('racer').util;
var contexts = require('derby-templates').contexts;

Page.prototype.render = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  this.res.setHeader('Cache-Control', 'no-store');

  this._setRenderParams(ns);
  var html = this.get('Page', ns);

  var page = this;
  this.model.destroy('$components');
  this.model.bundle(function(err, bundle) {
    if (err) return page.emit('error', err);
    html += '<script defer async onload=\'require("derby").init(' +
      stringifyBundle(bundle) + ');this.removeAttribute("onload")\' src="' +
      page.app.scriptUrl + '"></script>';
    if (status) {
      page.res.send(status, html);
    } else {
      page.res.send(html);
    }
  });
};

Page.prototype.renderStatic = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  this._setRenderParams(ns);
  var html = this.get('Page', ns);
  if (status) {
    this.res.send(status, html);
  } else {
    this.res.send(html);
  }
};

function stringifyBundle(bundle) {
  // Pretty the output in development
  var json = (util.isProduction) ?
    JSON.stringify(bundle) :
    JSON.stringify(bundle, null, 2);
  if (!json) return json;
  // Escape the output for use in a single-quoted attribute, since JSON will
  // contain lots of double quotes
  // Replace 2028 and 2029 because: http://timelessrepo.com/json-isnt-a-javascript-subset
  return json.replace(/[&'\u2028\u2029]/g, function(match) {
    return (match === '&') ? '&amp;' :
      (match === '\'') ? '&#39;' :
      (match === '\u2028') ? '\\u2028' :
      (match === '\u2029') ? '\\u2029' :
      match;
  });
}

// Override Page::_createContext to not create bindings on the server
Page.prototype._createContext = function() {
  var contextMeta = new contexts.ContextMeta({
    views: this.app && this.app.views
  });
  return new contexts.Context(contextMeta, this);
};
