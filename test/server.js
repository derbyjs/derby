var fs = require('fs');
var path = require('path');
var express = require('express');
var bundle = require('racer/lib/Model/bundle');

var app = express();

app
  .use(express.static('../node_modules/mocha'))
  .use(express.static('../node_modules/expect.js'))
  .use(express.static(__dirname))

app.get('/test/:filename', function(req, res, next) {
  var file = __dirname + '/' + req.params.filename;
  sendBundle(file, res, next);
});

app.get('/derby-standalone', function(req, res, next) {
  var file = path.dirname(__dirname) + '/lib/standalone';
  sendBundle(file, res, next);
});

function sendBundle(file, res, next) {
  var bundleOptions = {
    minify: false
  , configure: function(b) {
      b.add(file);
    }
  };
  bundle(bundleOptions, function(err, code, map) {
    if (err) return next(err);
    res.type('js');
    res.send(code);
  });
}

var port = process.env.PORT || 7777;
app.listen(port, function(err) {
  console.log('Derby test server running at http://localhost:' + port);
});
