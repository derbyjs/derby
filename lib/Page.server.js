var Page = require('./Page');
var util = require('racer').util;

Page.prototype.render = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  var res = this.res;
  setContentType(res);
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  res.setHeader('Cache-Control', 'no-store');

  this._setRenderParams(ns);
  var html = this.get('Page', ns);

  this.model.destroy('$components');
  var app = this.app;
  this.model.bundle(function(err, bundle) {
    if (err) {
      console.error(err.stack || err);
      res.send(503);
      return;
    }
    var bundleHtml = '<script defer async onload=\'require("derby").init(' +
      stringifyBundle(bundle) + ');this.removeAttribute("onload")\' src="' +
      app.scriptUrl + '"></script>';
    res.send(status, html + bundleHtml);
  });
};

Page.prototype.renderStatic = function(status, ns) {
  if (typeof status !== 'number') {
    ns = status;
    status = null;
  }
  setContentType(this.res);
  this._setRenderParams(ns);
  var html = this.get('Page', ns);
  this.res.send(status, html);
};

function setContentType(res) {
  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
}

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
