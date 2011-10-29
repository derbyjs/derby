#!/usr/bin/env node

derby = require '../derby'
{exec} = require 'child_process'
program = require 'commander'
mkdirp = require 'mkdirp'
fs = require 'fs'
{join} = require 'path'


## TEMPLATES ##

APP_COFFEE = '''
{get, view, ready} = require('derby').createApp module

## ROUTES ##

start = +new Date()

# Derby routes can be rendered on the client and the server
get '/:room?', (page, model, {room}) ->
  room ||= 'home'

  # Subscribes the model to any updates on this room's object. Also sets a
  # model reference to the room. This is equivalent to:
  #   model.set '_room', model.ref "rooms.#{room}"
  model.subscribe _room: "rooms.#{room}", ->

    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.welcome', "Welcome to #{room}!"

    model.incr '_room.visits'

    # This value is set for when the page initially renders
    model.set '_timer', '0.0'
    # Reset the counter when visiting a new route client-side
    start = +new Date()

    # Render will use the model data as well as an optional context object
    page.render
      room: room
      randomUrl: parseInt(Math.random() * 1e9).toString(36)


## CONTROLLER FUNCTIONS ##

ready (model) ->
  timer = null

  # Exported functions are exposed as a global in the browser with the same
  # name as the module that includes Derby. They can also be bound to DOM
  # events using the "x-bind" attribute in a template.
  exports.stop = ->

    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server.
    model.set '_stopped', true
    clearInterval timer

  do exports.start = ->
    model.set '_stopped', false
    timer = setInterval ->
      model.set '_timer', (((+new Date()) - start) / 1000).toFixed(1)
    , 100

'''

APP_JS = '''
var <<app>> = require('derby').createApp(module),
    get = <<app>>.get,
    view = <<app>>.view,
    ready = <<app>>.ready,
    start;

// ROUTES //

start = +new Date();

// Derby routes can be rendered on the client and the server
get('/:room?', function(page, model, params) {
  var room = params.room || 'home';

  // Subscribes the model to any updates on this room's object. Also sets a
  // model reference to the room. This is equivalent to:
  //   model.set('_room', model.ref('rooms.' + room));
  model.subscribe({ _room: 'rooms.' + room }, function() {

    // setNull will set a value if the object is currently null or undefined
    model.setNull('_room.welcome', 'Welcome to ' + room + '!');

    model.incr('_room.visits');

    // This value is set for when the page initially renders
    model.set('_timer', '0.0');
    // Reset the counter when visiting a new route client-side
    start = +new Date();

    // Render will use the model data as well as an optional context object
    page.render({
      room: room,
      randomUrl: parseInt(Math.random() * 1e9).toString(36)
    });
  });
});


// CONTROLLER FUNCTIONS //

ready(function(model) {
  var timer;

  // Exported functions are exposed as a global in the browser with the same
  // name as the module that includes Derby. They can also be bound to DOM
  // events using the "x-bind" attribute in a template.
  exports.stop = function() {

    // Any path name that starts with an underscore is private to the current
    // client. Nothing set under a private path is synced back to the server.
    model.set('_stopped', true);
    clearInterval(timer);
  }

  var fn = function() {
    model.set('_stopped', false);
    timer = setInterval(function() {
      model.set('_timer', (((+new Date()) - start) / 1000).toFixed(1));
    }, 100);
  };
  (exports.start = fn)();
});

'''

SERVER_COFFEE = '''
path = require 'path'
express = require 'express'
derby = require 'derby'
gzip = require 'connect-gzip'
<<app>> = require '../<<app>>'


## SERVER CONFIGURATION ##

MAX_AGE_ONE_YEAR = maxAge: 1000 * 60 * 60 * 24 * 365
root = path.dirname path.dirname __dirname
publicPath = path.join root, 'public'
staticPages = derby.createStatic root

(server = express.createServer())
  # The express.static middleware can be used instead of gzip.staticGzip
  .use(gzip.staticGzip(publicPath, MAX_AGE_ONE_YEAR))
  .use(express.favicon())

  # Uncomment to add form data parsing support
  # .use(express.bodyParser())
  # .use(express.methodOverride())

  # Uncomment and supply secret to add Derby session handling
  # Derby session middleware creates req.model and subscribes to _session
  # .use(express.cookieParser())
  # .use(express.session(secret: '', cookie: MAX_AGE_ONE_YEAR))
  # .use(<<app>>.session())

  # The router method creates an express middleware from the app's routes
  .use(<<app>>.router())
  .use(server.router)

  # Remove to disable dynamic gzipping
  .use(gzip.gzip())


## ERROR HANDLING ##

server.configure 'development', ->
  # Log errors in development only
  server.error (err, req, res, next) ->
    if err then console.log(if err.stack then err.stack else err)
    next err

server.error (err, req, res) ->
  ## Customize error handling here ##
  message = err.message || err.toString()
  status = parseInt message
  if status is 404 then staticPages.render '404', res, {url: req.url}, 404
  else res.send if 400 <= status < 600 then status else 500


## SERVER ONLY ROUTES ##

server.all '*', (req) ->
  throw "404: #{req.url}"


## STORE SETUP ##

store = <<app>>.createStore listen: server

## TODO: Remove when using a database ##
# Clear all data every time the node server is started
store.flush()

server.listen 3000
console.log 'Express server started in %s mode', server.settings.env
console.log 'Go to: http://localhost:%d/', server.address().port

'''

SERVER_JS = '''
var path = require('path'),
    express = require('express'),
    derby = require('derby'),
    gzip = require('connect-gzip'),
    <<app>> = require('../<<app>>');


// SERVER CONFIGURATION //

var MAX_AGE_ONE_YEAR = { maxAge: 1000 * 60 * 60 * 24 * 365 },
    root = path.dirname(path.dirname(__dirname)),
    publicPath = path.join(root, 'public'),
    staticPages = derby.createStatic(root),
    server, store;

(server = express.createServer())
  // The express.static middleware can be used instead of gzip.staticGzip
  .use(gzip.staticGzip(publicPath, MAX_AGE_ONE_YEAR))
  .use(express.favicon())

  // Uncomment to add form data parsing support
  // .use(express.bodyParser())
  // .use(express.methodOverride())

  // Uncomment and supply secret to add Derby session handling
  // Derby session middleware creates req.model and subscribes to _session
  // .use(express.cookieParser())
  // .use(express.session({ secret: '', cookie: MAX_AGE_ONE_YEAR }))
  // .use(<<app>>.session())

  // The router method creates an express middleware from the app's routes
  .use(<<app>>.router())
  .use(server.router)

  // Remove to disable dynamic gzipping
  .use(gzip.gzip());


// ERROR HANDLING //

server.configure('development', function() {
  // Log errors in development only
  server.error(function(err, req, res, next) {
    if (err) console.log(err.stack ? err.stack : err);
    next(err);
  });
});

server.error(function(err, req, res) {
  // Customize error handling here //
  var message = err.message || err.toString(),
      status = parseInt(message);
  if (status === 404) {
    staticPages.render('404', res, {url: req.url}, 404);
  } else {
    res.send( ((status >= 400) && (status < 600)) ? status : 500 );
  }
});


// SERVER ONLY ROUTES //

server.all('*', function(req) {
  throw '404: ' + req.url;
});


// STORE SETUP //

store = <<app>>.createStore({ listen: server });

// TODO: Remove when using a database //
// Clear all data every time the node server is started
store.flush();

server.listen(3000);
console.log('Express server started in %s mode', server.settings.env);
console.log('Go to: http://localhost:%d/', server.address().port);

'''

APP_HTML = '''
<!--
  Derby templates are similar to Mustache, except that they are first
  parsed as HTML, and there are a few extensions to make them work directly
  with models. A single HTML template defines the HTML output, the event
  handlers that update the model after user interaction, and the event handlers
  that update the DOM when the model changes.

  As in Mustache, double and triple curly braces output a value literally.
  Derby templates add double and triple parentheses, which output a value
  and set up model <- -> view bindings for that object.

  Elements that end in colon define template names. Pre-defined templates
  are capitalized by convention, but template names are case-insensitive.
  Pre-defined templates are automatically included when the page is rendered.
-->

<Title:>
  {{room}} - ((_room.visits)) visits

<Body:>
  <h1>((_room.welcome))</h1>
  <p><label>Welcome message: <input value="((_room.welcome))"></label>

  <p>This page has been visted ((_room.visits)) times. {{> timer}}

  <p>Let's go <a href="/{{randomUrl}}">somewhere random</a>.

<timer:>
  ((#_stopped))
    <a x-bind="click:start">Start timer</a>
  ((^))
    You have been here for ((_timer)) seconds. <a x-bind="click:stop">Stop</a>
  ((/))

'''

_404_HTML = '''
<!--
  This is a static template file, so it doesn't have an associated app.
  It is rendered by the server via a staticPages renderer.

  Since static pages don't include the Derby client library, they can't have
  bound variables that automatically update. However, they do support initial
  template tag rendering from a context object and/or model.
-->

<Title:>
  Not found

<Body:>
  <h1>404</h1>
  <p>Sorry, we can't find anything at <b>{{url}}</b>.
  <p>Try heading back to the <a href="/">home page</a>.

'''

RESET_STYL = '''
body,h1,h2,h3,h4,th {
  font: 13px/normal Arial,sans-serif;
}
ins {
  text-decoration: none;
}
body {
  background: #fff;
  color: #000;
}
body,fieldset,form,h1,h2,h3,h4,li,ol,p,td,th,ul {
  margin: 0;
  padding: 0;
}
ul {
  margin: 0 normal;
}
table {
  border-collapse: collapse;
  border-spacing: 0;
}
fieldset,img {
  border: 0;
}

'''

BASE_STYL = '''
@import "./reset";
@import "nib/vendor";

body {
  padding: 2em;
}
h1 {
  font-size: 2em;
  margin-bottom: .5em;
}
p {
  line-height: 2em;
}

'''

APP_STYL = '''
@import "../base";

'''

_404_STYL = '''
@import "./base";

'''

SERVER = '''
require('./lib/server');

'''

MAKEFILE_COFFEE = '''
compile:
	./node_modules/coffee-script/bin/coffee -bw -o ./lib -c ./src

'''

README = '''
# <<project>>

'''

GITIGNORE_COFFEE = '''
.DS_Store
node_modules
public/gen
lib/

'''

GITIGNORE_JS = '''
.DS_Store
node_modules
public/gen

'''

packageJson = (project, useCoffee) ->
  package =
    name: project
    description: ''
    version: '0.0.0'
    main: './server.js'
    dependencies:
      derby: '*'
      express: '>=2 <3'
      'connect-gzip': '>=0.1.4'
    private: true

  if useCoffee
    package.devDependencies =
      'coffee-script': '>=1.1.2'

  return JSON.stringify package, null, '  '


## COMMANDS ##

printUsage = true

# Adapted from https://github.com/loopj/commonjs-ansi-color
ANSI_CODES =
  'off': 0
  'bold': 1
  'italic': 3
  'underline': 4
  'blink': 5
  'inverse': 7
  'hidden': 8
  'black': 30
  'red': 31
  'green': 32
  'yellow': 33
  'blue': 34
  'magenta': 35
  'cyan': 36
  'white': 37
  'black_bg': 40
  'red_bg': 41
  'green_bg': 42
  'yellow_bg': 43
  'blue_bg': 44
  'magenta_bg': 45
  'cyan_bg': 46
  'white_bg': 47

styleTag = (name) -> "\033[#{ANSI_CODES[name]}m"

style = (styles, text) ->
  styles = styles.split ' '
  out = ''
  out += styleTag style  for style in styles
  return out + text + styleTag('off')

emptyDirectory = (path, callback) ->
  fs.readdir path, (err, files) ->
    throw err  if err && err.code isnt 'ENOENT'
    callback !files || !files.length

makeCallback = (path, callback) ->
  (err) ->
    throw err if err
    console.log style('green', '  created: ') + path
    callback() if callback

mkdir = (path, callback) ->
  mkdirp path, 0755, makeCallback(path, callback)

writeFile = (path, text, callback) ->
  fs.writeFile path, text, makeCallback(path, callback)

render = (template, ctx) ->
  for key, value of ctx
    re = new RegExp '<<' + key + '>>', 'g'
    template = template.replace re, value
  return template

abort = (message) ->
  message ||= style 'red bold', '\n  Aborted  \n'
  console.error message
  process.exit 1


createProject = (dir, app, useCoffee) ->
  dirPath = join process.cwd(), dir
  project = if dir == '.' then 'derby-app' else dir
  views = dir + '/views'
  styles = dir + '/styles'
  scripts = if useCoffee then dir + '/src' else dir + '/lib'
  appViews = join views, app
  appStyles = join styles, app
  appScripts = join scripts, app
  serverScripts = scripts + '/server'

  logComplete = ->
    message = style('green bold', '\n  Project created!') + '\n\n  Try it out:'
    message += "\n    $ cd #{dir}"  if dir != '.'
    message += '\n    $ npm install'  if program.noinstall
    if useCoffee
      message += """
      \n    $ make

        Then in a new terminal:
          $ cd #{dirPath}
      """
    message += """
    \n    $ node server.js

      More info at: http://derbyjs.com/

    """
    console.log message

  finish = ->
    return logComplete()  if program.noinstall
    process.chdir dir
    console.log '\n  Installing dependencies. This may take a little while...'
    exec 'npm install', (err, stdout, stderr) ->
      return console.error stderr if err
      console.log stdout.replace /^|\n/g, '\n  '  if stdout
      logComplete()

  count = 0
  wait = (callback) ->
    count++
    return ->
      callback()  if callback
      finish()  unless --count

  mkdir dir, ->
    mkdir dir + '/public/img', wait()
    mkdir appViews, wait ->
      writeFile appViews + '/index.html', APP_HTML, wait()
      writeFile views + '/404.html', _404_HTML, wait()
    mkdir appStyles, wait ->
      writeFile appStyles + '/index.styl', APP_STYL, wait()
      writeFile styles + '/404.styl', _404_STYL, wait()
      writeFile styles + '/reset.styl', RESET_STYL, wait()
      writeFile styles + '/base.styl', BASE_STYL, wait()
    
    if useCoffee
      mkdir appScripts, wait ->
        writeFile appScripts + '/index.coffee', render(APP_COFFEE, {app}), wait()
      mkdir serverScripts, wait ->
        writeFile serverScripts + '/index.coffee', render(SERVER_COFFEE, {app}), wait()
      writeFile dir + '/Makefile', MAKEFILE_COFFEE, wait()
      writeFile dir + '/.gitignore', GITIGNORE_COFFEE, wait()
    else
      mkdir appScripts, wait ->
        writeFile appScripts + '/index.js', render(APP_JS, {app}), wait()
      mkdir serverScripts, wait ->
        writeFile serverScripts + '/index.js', render(SERVER_JS, {app}), wait()
      writeFile dir + '/.gitignore', GITIGNORE_JS, wait()

    writeFile dir + '/server.js', SERVER, wait()
    writeFile dir + '/package.json', packageJson(project, useCoffee), wait()
    writeFile dir + '/README.md', render(README, {project}), wait()

newProject = (dir = '.', app = 'app') ->
  printUsage = false
  useCoffee = program.coffee

  type = if useCoffee then 'CoffeeScript ' else ''
  directory = style 'bold',
    if dir is '.' then 'the current directory' else dir
  console.log "\n  Creating #{type}project in #{directory} with the application " +
    style('bold', app) + '\n'

  emptyDirectory dir, (empty) ->
    unless empty
      return program.confirm '  Destination is not empty. Continue? ', (ok) ->
        abort() unless ok
        process.stdin.destroy()
        createProject dir, app, useCoffee

    createProject dir, app, useCoffee


## CLI ##

program
  .version(derby.version)
  .option('-c, --coffee', 'create files using CoffeeScript')
  .option('-n, --noinstall', "don't run `npm install`")

program
  .command('new [dir] [app]')
  .description('''
    \nCreate a new Derby project. If no directory name is specified, or the
    name `.` is used, the project will be created in the current directory.
    A name for the default app may be specified optionally.''')
  .action(newProject)

program.parse process.argv

console.log '\n  See `derby --help` for usage\n' if printUsage
