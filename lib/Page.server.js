var Page = require('./Page');
var util = require('racer').util;

Page.prototype.render = function(name) {
  var res = this.res;
  if (!res.getHeader('content-type')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  }
  // Prevent the browser from storing the HTML response in its back cache, since
  // that will cause it to render with the data from the initial load first
  res.setHeader('Cache-Control', 'no-store');

  name = (name) ? 'app:' + name : 'app';
  var html =
    this.get('Doctype', name) +
    this.get('Root', name) +
    this.get('Charset', name) +
    this.get('Title', name) +
    this.get('Head', name) +
    this.get('Styles', name) +
    this.get('Header', name) +
    this.get('Body', name) +
    this.get('Footer', name) +
    this.get('Scripts', name);
  var tail =
    this.get('Tail', name);

  if (this.isStatic) {
    res.send(html + tail);
    return;
  }
  this.model.destroy('$components');
  var app = this.app;
  this.model.bundle(function(err, bundle) {
    var bundleHtml = '<script defer async onload=\'require("derby").init(' +
      stringifyBundle(bundle) + ');this.removeAttribute("onload")\' src="' +
      app.scriptUrl + '"></script>';
    res.send(html + bundleHtml + tail);
  });
};

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
