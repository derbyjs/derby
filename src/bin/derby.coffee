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
    model.set '_timing', false
    clearInterval timer

  do exports.start = ->
    model.set '_timing', true
    timer = setInterval ->
      model.incr '_timer', 0.1
    , 100

'''

APP_JS = '''

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
static = derby.createStatic root

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
  if status is 404 then static.render '404', res, {url: req.url}, 404
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
console.log 'Go to: http://localhost:3000/'

'''

SERVER_JS = '''
path = require 'path'
express = require 'express'
derby = require 'derby'
gzip = require 'connect-gzip'
<<app>> = require '../<<app>>'


//// SERVER CONFIGURATION ////

var MAX_AGE_ONE_YEAR = { maxAge: 1000 * 60 * 60 * 24 * 365 },
    root = path.dirname(path.dirname(__dirname)),
    publicPath = path.join(root, 'public'),
    static = derby.createStatic(root),
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


//// ERROR HANDLING ////

server.configure('development', function() {
  // Log errors in development only
  server.error(function(err, req, res, next) {
    if (err) console.log(err.stack ? err.stack : err);
    next(err);
  });
});

server.error(function(err, req, res) {
  //// Customize error handling here ////
  var message = err.message || err.toString(),
      status = parseInt(message);
  if (status === 404) {
    static.render('404', res, {url: req.url}, 404);
  } else {
    res.send( ((status >= 400) && (status < 600)) ? status : 500 );
  }
});


//// SERVER ONLY ROUTES ////

server.all('*', function(req) {
  throw '404: ' + req.url;
});


//// STORE SETUP ////

store = <<app>>.createStore({ listen: server });

//// TODO: Remove when using a database ////
// Clear all data every time the node server is started
store.flush();

server.listen(3000);
console.log('Go to: http://localhost:3000/');

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

  <p>{{> timer}}

  <p>Let's go <a href="/{{randomUrl}}">somewhere random</a>.

<timer:>
  You have been on this page for ((_timer)) seconds. 
  ((#_timing))
    <a x-bind="click:stop">Stop</a>
  ((^))
    <a x-bind="click:start">Start</a>
  ((/))

'''

_404_HTML = '''
<!--
  This is a static template file, so it doesn't have an associated app.
  It is rendered by the server via a static renderer.

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
all:
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
    main: './server.js'
    dependencies
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

mkdir = (path, callback) ->
  mkdirp path, 0755, (err) ->
    throw err if err
    console.log style('green', 'created: ') + path
    callback() if callback

writeFile = (path, text) ->
  fs.writeFile path, text, (err) ->
    throw err if err
    console.log style('green', 'created: ') + path

render = (template, ctx) ->
  for key, value of ctx
    re = new RegExp '<<' + key + '>>', 'g'
    template = template.replace re, value
  return template

abort = (message = 'aborting') ->
  console.error message
  process.exit 1


createProject = (dir, app, useCoffee) ->
  project = if dir == '.' then 'Derby App' else dir
  views = dir + '/views'
  styles = dir + '/styles'
  scripts = if useCoffee then dir + '/lib' else dir + '/src'
  appViews = join views, app
  appStyles = join styles, app
  appScripts = join scripts, app
  serverScripts = scripts + '/server'

  mkdir dir + '/public/img'
  mkdir appViews, ->
    writeFile appViews + '/index.html', APP_HTML
    writeFile views + '/404.html', _404_HTML
  mkdir appStyles, ->
    writeFile appStyles + '/index.styl', APP_STYL
    writeFile styles + '/404.styl', _404_STYL
    writeFile styles + '/reset.styl', RESET_STYL
    writeFile styles + '/base.styl', BASE_STYL
  
  if useCoffee
    mkdir appScripts, ->
      writeFile appScripts + '/index.coffee', render APP_COFFEE, {app}
    mkdir serverScripts, ->
      writeFile serverScripts + '/index.coffee', render SERVER_COFFEE, {app}
    writeFile dir + '/Makefile', MAKEFILE_COFFEE
    writeFile dir + '/.gitignore', GITIGNORE_COFFEE
  else
    mkdir appScripts, ->
      writeFile appScripts + '/index.js', render APP_JS, {app}
    mkdir serverScripts, ->
      writeFile serverScripts + '/index.js', render SERVER_JS, {app}
    writeFile dir + '/.gitignore', GITIGNORE_JS
  
  writeFile dir + '/server.js', SERVER
  writeFile dir + '/package.json', packageJson(project, useCoffee)
  writeFile dir + '/README.md', render README, {project}

newProject = (dir = '.', app = 'app') ->
  printUsage = false
  useCoffee = program.coffee

  type = if useCoffee then 'CoffeeScript ' else ''
  directory = style 'magenta',
    if dir is '.' then 'the current directory' else dir
  console.log "creating #{type}project in #{directory} with the application " +
    style('magenta', app)

  emptyDirectory dir, (empty) ->
    unless empty
      return program.confirm 'destination is not empty; continue? ', (ok) ->
        abort() unless ok
        process.stdin.destroy()
        createProject dir, app, useCoffee

    createProject dir, app, useCoffee


## CLI ##

program
  .version(derby.version)
  .option('-c, --coffee', 'create files using CoffeeScript')

program
  .command('new [dir] [app]')
  .description('''
    \nCreate a new Derby project. If no directory name is specified, or the
    name `.` is used, the project will be created in the current directory.
    A name for the default app may be specified optionally.''')
  .action(newProject)

program.parse process.argv

console.log 'see `derby --help` for usage' if printUsage
