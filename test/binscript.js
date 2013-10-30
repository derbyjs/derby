var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var assert = require('better-assert');
var rimraf = require('rimraf');

var bin = path.resolve(__dirname + '/../bin');

before(function(done) {
  rimraf(__dirname + '/fixtures/foo', function(err) {
    assert(!err);
    done();
  });
});

describe('A sanity Test', function() {
  it('should pass', function() {
    assert(true);
  });
});

describe('Help output', function() {
  it('Should be produced when no arguments are passed to the process', function(done) {
     exec('derby', { cwd: bin }, function (err, stdout, stderr) {
       assert(stdout.length > 0);
       done();
     });
  });
});

describe('Help output', function() {
  it('Should be produced when -h passed to the process', function(done) {
     exec('derby -h', { cwd: bin }, function (err, stdout, stderr) {
       assert(stdout.length > 0);
       done();
     });
  });
});

describe('The binscript bundler feature', function() {

  it('should bundle two files', function(done) {

    exec(
      'derby -b', 
      { cwd: bin },
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
  it('should produce a boilerplate project', function(done) {

   exec(
    'derby -c ' + __dirname + '/fixtures/foo foo --noinstall', 
    { cwd: bin },
    function (err, stdout, stderr) {
      assert(fs.statSync(__dirname + '/fixtures/foo/lib'));
      assert(fs.statSync(__dirname + '/fixtures/foo/styles'));
      assert(fs.statSync(__dirname + '/fixtures/foo/ui'));
      assert(fs.statSync(__dirname + '/fixtures/foo/views'));
      done();
    });
  });
});


