var spawn = require('child_process').spawn;
var mkdirp = require('mkdirp');
var fs = require('fs');
var psexit = require('psexit');
var path = require('path');

function emptyDirectory(path, callback) {
  fs.readdir(path, function(err, files) {
    if (err && err.code !== 'ENOENT') throw err;
    callback(!files || !files.length);
  });
}

function mkdir(path) {
  mkdirp.sync(path, '0755');
  //console.log('created: %s', path);
}

function write(path, text) {
  fs.writeFileSync(path, text);
  // console.log('created: %s', path);
}

function render(template, ctx) {
  for (var key in ctx) {
    var value = ctx[key];
    var re = new RegExp('\\$\\$' + key + '\\$\\$', 'g');
    template = template.replace(re, value);
  }
  return template;
}

function walkSync(start, callback) {
  var stat = fs.statSync(start);

  if (stat.isDirectory()) {
    var filenames = fs.readdirSync(start);

    var coll = filenames.reduce(function(acc, name) {
      var abspath = path.join(start, name);

      if (fs.statSync(abspath).isDirectory()) {
        acc.dirs.push(name);
      } else {
        acc.names.push(name);
      }

      return acc;
    }, {'names': [], 'dirs': []});

    callback(start, coll.dirs, coll.names);

    coll.dirs.forEach(function(d) {
      var abspath = path.join(start, d);
      if (d === 'node_modules') return;
      walkSync(abspath, callback);
    });

  } else {
    throw new Error('path: ' + start + ' is not a directory');
  }
}

function create(argv, dir, app, useCoffee) {
  
  var dirPath = path.resolve(process.cwd(), dir);
  var project = path.basename(dirPath);
  
  if (!project) throw new Error('Cannot create project at ' + dirPath);
  
  var ctx = {
    app: app
  , project: project
  };

  // Copy default project files to specified destination
  mkdir(dirPath);
  var startDir = (useCoffee) ? '/default-coffee' : '/default-js';
  var start = path.join(__dirname, '..', startDir);
  walkSync(start, function(dir, dirs, files) {
    var base = dirPath + render(dir, ctx).slice(start.length) + '/';
    dirs.forEach(function(dir) {
      mkdir(base + render(dir, ctx));
    });
    files.forEach(function(file) {
      data = fs.readFileSync(dir + '/' + file, 'utf-8');
      filename = base + render(file, ctx);
      write(filename, render(data, ctx));
    });
  });

  function logComplete() {
    var message = '\n\n  Project created!' + '\n\n  Try it out:';
    if (dir !== '.') {
      message += '\n    $ cd ' + dir;
    }
    if (argv['noinstall']) {
      message += '\n    $ npm install';
    }
    message += '\n    $ npm start';
    message += '\n\n  More info at: http://derbyjs.com/\n';
    console.log(message);
  };

  if (argv['noinstall']) {
    return logComplete();
  }

  var spinner = ['|', '/', '-', '\\'];
  spinnerIndex = 0;

  function spin() {
     process.stdout.write(
      '\r' + (spinner[spinnerIndex++] || 
      spinner[spinnerIndex = 0, spinnerIndex++])
    );
  }

  console.log(
    'Installing dependencies for %s. ' +
    'Performance can vary depending on your network', app);
  var cp = spawn('npm', ['install'], { cwd: dir });

  cp.stdout.on('data', spin);
  cp.stderr.on('data', spin);

  psexit(cp, function (err, data) {
    logComplete();
  });
}

exports.create = function(argv, dir, app) {

  dir = path.resolve(process.cwd(), dir || '.');
  app = app || 'app';

  var useCoffee = argv.coffee ? 'CoffeeScript' : false;

  emptyDirectory(dir, function(empty) {

    if (!empty && !argv.f) {
      console.error('Destination not empty. Use -f to force.');
      process.exit(1);
    }

    console.log(
      'Creating project %s in %s', 
      app, dir === '.' ? 'the current directory' : dir
    );

    create(argv, dir, app, useCoffee);
  });
}

