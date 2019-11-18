var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var express = require('express');

var expressApp = express();
expressApp.use(express.static(__dirname + '/public'));
expressApp.use(express.static(__dirname + '/../node_modules/mocha'));

expressApp.get('/test.js', function(req, res, next) {
  var bundle = browserify({debug: true});
  addScriptsInRelativeDirs(bundle, ['/all', '/dom', '/browser'], function(err) {
    if (err) return next(err);
    bundle.bundle(function(err, code) {
      if (err) return next(err);
      res.type('js');
      res.send(code);
    });
  });
});

function addScriptsInRelativeDirs(bundle, dirs, callback) {
  var i = 0;
  (function nextDir() {
    if (i >= dirs.length) {
      return callback();
    }
    addScripts(bundle, __dirname + dirs[i], function(err) {
      if (err) return callback(err);
      i++;
      nextDir();
    });
  })();
}

function addScripts(bundle, dir, callback) {
  fs.readdir(dir, function(err, files) {
    if (err) return callback(err);
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (path.extname(file) !== '.js') continue;
      bundle.add(path.join(dir, file));
    }
    callback();
  });
}

var port = process.env.PORT || 5555;
var server = expressApp.listen(port, function(err) {
  console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
});
