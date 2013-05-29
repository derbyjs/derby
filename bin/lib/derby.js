var exec = require('child_process').exec;
var program = require('commander');
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');
var derby = require('../../lib/derby');

printUsage = true;

ANSI_CODES = {
  'off': 0,
  'bold': 1,
  'italic': 3,
  'underline': 4,
  'blink': 5,
  'inverse': 7,
  'hidden': 8,
  'black': 30,
  'red': 31,
  'green': 32,
  'yellow': 33,
  'blue': 34,
  'magenta': 35,
  'cyan': 36,
  'white': 37,
  'black_bg': 40,
  'red_bg': 41,
  'green_bg': 42,
  'yellow_bg': 43,
  'blue_bg': 44,
  'magenta_bg': 45,
  'cyan_bg': 46,
  'white_bg': 47
};

function styleTag(name) {
  return '\u001b[' + ANSI_CODES[name] + 'm';
}

function style(styles, text) {
  var out = '';
  var split = styles.split(' ');
  for (var i = 0; i < split.length; i++) {
    item = split[i];
    out += styleTag(item);
  }
  return out + text + styleTag('off');
}

function emptyDirectory(path, callback) {
  fs.readdir(path, function(err, files) {
    if (err && err.code !== 'ENOENT') throw err;
    callback(!files || !files.length);
  });
}

function logWrite(path) {
  console.log(style('green', '  created: ') + path);
}
function mkdir(path) {
  mkdirp.sync(path, '0755');
  logWrite(path);
}
function write(path, text) {
  fs.writeFileSync(path, text);
  logWrite(path);
}

function render(template, ctx) {
  for (var key in ctx) {
    var value = ctx[key];
    var re = new RegExp('\\$\\$' + key + '\\$\\$', 'g');
    template = template.replace(re, value);
  }
  return template;
}

function abort(message) {
  message || (message = style('red bold', '\n  Aborted  \n'));
  console.error(message);
  return process.exit(1);
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

function createProject(dir, app, useCoffee) {
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
    var message = style('green bold', '\n  Project created!') + '\n\n  Try it out:';
    if (dir !== '.') {
      message += '\n    $ cd ' + dir;
    }
    if (program.noinstall) {
      message += '\n    $ npm install';
    }
    message += '\n    $ npm start';
    message += '\n\n  More info at: http://derbyjs.com/\n';
    console.log(message);
  };
  if (program.noinstall) return logComplete();
  process.chdir(dir);
  console.log('\n  Installing dependencies. This may take a little while...');
  exec('npm install', function(err, stdout, stderr) {
    if (err) return console.error(stderr);
    if (stdout) console.log(stdout.replace(/^|\n/g, '\n  '));
    logComplete();
  });
}

function newProject(dir, app) {
  if (dir == null) dir = '.';
  if (app == null) app = 'app';

  printUsage = false;
  var useCoffee = program.coffee;
  var type = useCoffee ? 'CoffeeScript ' : '';
  var directory = style('bold', dir === '.' ? 'the current directory' : dir);
  console.log(
    '\n  Creating ' + type + 'project in ' + directory +
    ' with the application ' + style('bold', app) + '\n'
  );
  emptyDirectory(dir, function(empty) {
    if (!empty) {
      program.confirm('  Destination is not empty. Continue? ', function(ok) {
        if (!ok) abort();
        process.stdin.destroy();
        createProject(dir, app, useCoffee);
      });
      return;
    }
    createProject(dir, app, useCoffee);
  });
}

program
  .version(derby.version)
  .option('-c, --coffee', 'create files using CoffeeScript')
  .option('-n, --noinstall', 'do not run `npm install`');

program
  .command('new [dir] [app]')
  .description(
    '\nCreate a new Derby project. If no directory name is specified, or the\n' +
    'name `.` is used, the project will be created in the current directory.\n' +
    'A name for the default app may be specified optionally.')
  .action(newProject);

program.parse(process.argv);

if (printUsage) console.log('\n  See `derby --help` for usage\n');
