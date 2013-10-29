var fs = require('fs');
var browserify = require('browserify');
var uglify = require('uglify-js');

function bundle(argv, sourcefiles, targetfile, cb) {
  
  var isProduction = argv.env == 'production';
  var b = browserify();

  sourcefiles.forEach(function(dir) {
    b.add(dir);
  });

  var opts = {
    debug: argv.debug == null && !isProduction;
  };
  
  function write(code) {
    fs.writeFile(targetfile, code, cb);
  }

  b.bundle(opts, function(err, code) {
    if (err) return cb(err);

    if (argv.m || isProduction) {
      var minified = uglify.minify(code, {
        fromString: true, 
        outSourceMap: 'minified.js.map'
      });
      // note, the map is unused.
      return write(minified.code);
    }
    write(code);
  });
};

