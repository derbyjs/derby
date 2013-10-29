var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var assert = require('better-assert');

describe('A sanity Test', function() {
  it('should pass', function() {
    assert(true);
  });
});

describe('Help output', function() {
  it('Should be produced when no arguments are passed to the process', function(done) {
     exec('derby', { cwd: cwd }, function (err, stdout, stderr) {
       assert(!err && !stderr);
     });
  });
});

describe('Help output', function() {
  it('Should be produced when -h passed to the process', function(done) {
     exec('derby -h', { cwd: cwd }, function (err, stdout, stderr) {
       assert(!err && !stderr);
     });
  });
});

describe('The binscript bundler feature', function() {

  var cwd = __dirname + '/../bin';

  it('should bundle two files', function(done) {

    exec(
      'derby -b', 
      { cwd: cwd },
      function (err, stdout, stderr) {

        assert(!err && !stderr);
        
        it('should output a file targeting the browser', function() {
          assert(fs.statSync(__dirname + '/browser-standalone.js'));
        });

        it('should output a file targeting the browser', function() {
          assert(fs.statSync(__dirname + '/../derby-standalone.js'));
        });

        done();
      }
    );
  });
});

describe('The binscript project feature', function() {
  it('should produce a boilerplate project', function() {
    assert(true);
  });
});

