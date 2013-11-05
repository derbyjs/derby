var Page = require('./Page');
var util = require('racer').util;

Page.prototype.render = function(ns) {
  var res = this.res;
  setContentType(res);
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  res.setHeader('Cache-Control', 'no-store');

  ns = (ns) ? 'app:' + ns : 'app';
  this.model.set('$render.ns', ns);

  var html = this.get('Page', ns);
  res.write(html);

  this.model.destroy('$components');
  var app = this.app;
  this.model.bundle(function(err, bundle) {
    var bundleHtml = '<script defer async onload=\'require("derby").init(' +
      stringifyBundle(bundle) + ');this.removeAttribute("onload")\' src="' +
      app.scriptUrl + '"></script>';
    res.end(bundleHtml);
  });
};

Page.prototype.renderStatic = function(ns) {
  setContentType(this.res);

  ns = (ns) ? 'app:' + ns : 'app';
  this.model.set('$render.ns', ns);
  var html = this.get('Page', ns);

  this.res.send(html);
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
