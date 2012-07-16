{exec} = require 'child_process'
program = require 'commander'
mkdirp = require 'mkdirp'
fs = require 'fs'
{join, resolve, basename} = require 'path'
derby = require '../../lib/derby'


## TEMPLATES ##

APP_COFFEE = '''
derby = require 'derby'
{get, view, ready} = derby.createApp module
derby.use(require '../../ui')


## ROUTES ##

start = +new Date()

# Derby routes can be rendered on the client and the server
get '/:roomName?', (page, model, {roomName}) ->
  roomName ||= 'home'

  # Subscribes the model to any updates on this room's object. Calls back
  # with a scoped model equivalent to:
  #   room = model.at "rooms.#{roomName}"
  model.subscribe "rooms.#{roomName}", (err, room) ->
    model.ref '_room', room

    # setNull will set a value if the object is currently null or undefined
    room.setNull 'welcome', "Welcome to #{roomName}!"

    room.incr 'visits'

    # This value is set for when the page initially renders
    model.set '_timer', '0.0'
    # Reset the counter when visiting a new route client-side
    start = +new Date()

    # Render will use the model data as well as an optional context object
    page.render
      roomName: roomName
      randomUrl: parseInt(Math.random() * 1e9).toString(36)


## CONTROLLER FUNCTIONS ##

ready (model) ->
  timer = null

  # Functions on the app can be bound to DOM events using the "x-bind"
  # attribute in a template.
  @stop = ->
    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server.
    model.set '_stopped', true
    clearInterval timer

  do @start = ->
    model.set '_stopped', false
    timer = setInterval ->
      model.set '_timer', (((+new Date()) - start) / 1000).toFixed(1)
    , 100

'''

APP_JS = '''
var derby = require('derby')
  , <<app>> = derby.createApp(module)
  , get = <<app>>.get
  , view = <<app>>.view
  , ready = <<app>>.ready
  , start = +new Date()

derby.use(require('../../ui'))


// ROUTES //

// Derby routes can be rendered on the client and the server
get('/:roomName?', function(page, model, params) {
  var roomName = params.roomName || 'home'

  // Subscribes the model to any updates on this room's object. Calls back
  // with a scoped model equivalent to:
  //   room = model.at('rooms.' + roomName)
  model.subscribe('rooms.' + roomName, function(err, room) {
    model.ref('_room', room)

    // setNull will set a value if the object is currently null or undefined
    room.setNull('welcome', 'Welcome to ' + roomName + '!')

    room.incr('visits')

    // This value is set for when the page initially renders
    model.set('_timer', '0.0')
    // Reset the counter when visiting a new route client-side
    start = +new Date()

    // Render will use the model data as well as an optional context object
    page.render({
      roomName: roomName
    , randomUrl: parseInt(Math.random() * 1e9).toString(36)
    })
  })
})


// CONTROLLER FUNCTIONS //

ready(function(model) {
  var timer

  // Functions on the app can be bound to DOM events using the "x-bind"
  // attribute in a template.
  this.stop = function() {
    // Any path name that starts with an underscore is private to the current
    // client. Nothing set under a private path is synced back to the server.
    model.set('_stopped', true)
    clearInterval(timer)
  }

  this.start = function() {
    model.set('_stopped', false)
    timer = setInterval(function() {
      model.set('_timer', (((+new Date()) - start) / 1000).toFixed(1))
    }, 100)
  }
  this.start()

})

'''

SERVER_COFFEE = '''
http = require 'http'
path = require 'path'
express = require 'express'
gzippo = require 'gzippo'
derby = require 'derby'
<<app>> = require '../<<app>>'
serverError = require './serverError'


## SERVER CONFIGURATION ##

expressApp = express()
server = module.exports = http.createServer expressApp

derby.use(derby.logPlugin)
store = derby.createStore listen: server

ONE_YEAR = 1000 * 60 * 60 * 24 * 365
root = path.dirname path.dirname __dirname
publicPath = path.join root, 'public'

expressApp
  .use(express.favicon())
  # Gzip static files and serve from memory
  .use(gzippo.staticGzip publicPath, maxAge: ONE_YEAR)
  # Gzip dynamically rendered content
  .use(express.compress())

  # Uncomment to add form data parsing support
  .use(express.bodyParser())
  .use(express.methodOverride())

  # Uncomment and supply secret to add Derby session handling
  # Derby session middleware creates req.session and socket.io sessions
  # .use(express.cookieParser())
  # .use(store.sessionMiddleware
  #   secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  #   cookie: {maxAge: ONE_YEAR}
  # )

  # Adds req.getModel method
  .use(store.modelMiddleware())
  # Creates an express middleware from the app's routes
  .use(<<app>>.router())
  .use(expressApp.router)
  .use(serverError root)


## SERVER ONLY ROUTES ##

expressApp.all '*', (req) ->
  throw "404: #{req.url}"

'''

SERVER_JS = '''
var http = require('http')
  , path = require('path')
  , express = require('express')
  , gzippo = require('gzippo')
  , derby = require('derby')
  , <<app>> = require('../<<app>>')
  , serverError = require('./serverError')


// SERVER CONFIGURATION //

var expressApp = express()
  , server = module.exports = http.createServer(expressApp)

derby.use(derby.logPlugin)
var store = derby.createStore({listen: server})

var ONE_YEAR = 1000 * 60 * 60 * 24 * 365
  , root = path.dirname(path.dirname(__dirname))
  , publicPath = path.join(root, 'public')

expressApp
  .use(express.favicon())
  // Gzip static files and serve from memory
  .use(gzippo.staticGzip(publicPath, {maxAge: ONE_YEAR}))
  // Gzip dynamically rendered content
  .use(express.compress())

  // Uncomment to add form data parsing support
  // .use(express.bodyParser())
  // .use(express.methodOverride())

  // Uncomment and supply secret to add Derby session handling
  // Derby session middleware creates req.model and subscribes to _session
  // .use(express.cookieParser())
  // .use(store.sessionMiddleware({
  //   secret: process.env.SESSION_SECRET || 'YOUR SECRET HERE'
  // , cookie: {maxAge: ONE_YEAR}
  // }))

  // Adds req.getModel method
  .use(store.modelMiddleware())
  // Creates an express middleware from the app's routes
  .use(<<app>>.router())
  .use(expressApp.router)
  .use(serverError(root))


// SERVER ONLY ROUTES //

expressApp.all('*', function(req) {
  throw '404: ' + req.url
})

'''

SERVER_ERROR_JS = '''
var derby = require('derby')
  , isProduction = derby.util.isProduction

module.exports = function(root) {
  var staticPages = derby.createStatic(root)

  return function(err, req, res, next) {
    if (err == null) return next()

    console.log(err.stack ? err.stack : err)

    // Customize error handling here
    var message = err.message || err.toString()
      , status = parseInt(message)
    if (status === 404) {
      staticPages.render('404', res, {url: req.url}, 404)
    } else {
      res.send( ((status >= 400) && (status < 600)) ? status : 500)
    }
  }
}

'''

SERVER_ERROR_COFFEE = '''
derby = require 'derby'
{isProduction} = derby.util

module.exports = (root) ->
  staticPages = derby.createStatic root

  return (err, req, res, next) ->
    return next() unless err?

    console.log(if err.stack then err.stack else err)

    ## Customize error handling here ##
    message = err.message || err.toString()
    status = parseInt message
    if status is 404
      staticPages.render '404', res, {url: req.url}, 404
    else
      res.send if 400 <= status < 600 then status else 500

'''

CONNECTION_ALERT_JS = '''
exports.connect = function() {
  model = this.model
  // Hide the reconnect link for a second after clicking it
  model.set('hideReconnect', true)
  setTimeout(function() {
    model.set('hideReconnect', false)
  }, 1000)
  model.socket.socket.connect()
}

exports.reload = function() {
  window.location.reload()
}

'''

UI_JS = '''
var config = {
  filename: __filename
, styles: '../styles/ui'
, scripts: {
    connectionAlert: require('./connectionAlert')
  }
};

module.exports = ui
ui.decorate = 'derby'

function ui(derby, options) {
  derby.createLibrary(config, options)
}

'''

APP_HTML = '''
<!--
  Derby templates are similar to Handlebars, except that they are first
  parsed as HTML, and there are a few extensions to make them work directly
  with models. A single HTML template defines the HTML output, the event
  handlers that update the model after user interaction, and the event handlers
  that update the DOM when the model changes.

  As in Handlebars, double curly braces output a value literally. Derby
  templates add single curly braces, which output a value and set up
  model <- -> view bindings for that object.

  Elements that end in colon define template names. Pre-defined templates
  are capitalized by convention, but template names are case-insensitive.
  Pre-defined templates are automatically included when the page is rendered.
-->

<Title:>
  {{roomName}} - {_room.visits} visits

<Header:>
  <!-- This is a component defined in the /ui directory -->
  <ui:connectionAlert>

<Body:>
  <h1>{_room.welcome}</h1>
  <p><label>Welcome message: <input value="{_room.welcome}"></label></p>

  <!-- Other templates are referenced like HTML elements -->
  <p>This page has been visted {_room.visits} times. <app:timer></p>

  <p>Let's go <a href="/{{randomUrl}}">somewhere random</a>.</p>

<timer:>
  {#if _stopped}
    <a x-bind="click:start">Start timer</a>
  {else}
    You have been here for {_timer} seconds. <a x-bind="click:stop">Stop</a>
  {/}

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

CONNECTION_ALERT_HTML = '''
<connectionAlert:>
  <div class="connection">
    <!--
      connected and canConnect are built-in properties of model. If a variable
      is not defined in the current context, it will be looked up in the model
      data and the model properties
    -->
    {#unless connected}
      <p class="alert">
        {#if canConnect}
          <!-- Leading space is removed, and trailing space is maintained -->
          Offline 
          <!-- a :self path alias is automatically created per component -->
          {#unless :self.hideReconnect}
            &ndash; <a x-bind="click:connect">Reconnect</a>
          {/}
        {else}
          Unable to reconnect &ndash; <a x-bind="click:reload">Reload</a>
        {/}
      </p>
    {/}
  </div>

'''

RESET_STYL = '''
body,h1,h2,h3,h4,th {
  font: 13px/normal Arial,sans-serif;
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

UI_STYL = '''
.connection {
  position: absolute;
  text-align: center;
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
  z-index: 99;
}
.connection > .alert {
  background: #fff1a8;
  border: 1px solid #999;
  border-top: 0;
  border-radius: 0 0 3px 3px;
  display: inline-block;
  line-height: 21px;
  padding: 0 12px;
}

'''

SERVER = '''
require('derby').run(__dirname + '/lib/server')

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
public/gen
lib/
*.swp

'''

GITIGNORE_JS = '''
.DS_Store
public/gen
*.swp

'''

packageJson = (project, useCoffee) ->
  pkg =
    name: project
    description: ''
    version: '0.0.0'
    main: './server.js'
    dependencies:
      derby: '*'
      express: '3.0.0beta4'
      gzippo: '>=0.1.7'
    private: true

  if useCoffee
    pkg.devDependencies =
      'coffee-script': '>=1.3.3'

  return JSON.stringify pkg, null, '  '


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

styleTag = (name) -> "\u001b[#{ANSI_CODES[name]}m"

style = (styles, text) ->
  out = ''
  for item in styles.split(' ')
    out += styleTag item
  return out + text + styleTag('off')

emptyDirectory = (path, callback) ->
  fs.readdir path, (err, files) ->
    throw err  if err && err.code isnt 'ENOENT'
    callback !files || !files.length

logWrite = (path) ->
  console.log style('green', '  created: ') + path

mkdir = (path) ->
  mkdirp.sync path, '0755'
  logWrite(path)

write = (path, text) ->
  fs.writeFileSync path, text
  logWrite(path)

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
  dirPath = resolve process.cwd(), dir
  unless project = basename dirPath
    throw new Error 'Cannot create project at ' + dirPath
  views = join dir, 'views'
  styles = join dir, 'styles'
  scripts = if useCoffee then join dir, 'src' else join dir, 'lib'
  appViews = join views, app
  appStyles = join styles, app
  ui = join dir, 'ui'
  connectionAlert = join ui, 'connectionAlert'
  appScripts = join scripts, app
  serverScripts = join scripts, 'server'

  mkdir dir
  mkdir join(dir, 'public', 'img')

  mkdir appViews
  write join(appViews, 'index.html'), APP_HTML
  write join(views, '404.html'), _404_HTML
  
  mkdir appStyles
  write join(appStyles, 'index.styl'), APP_STYL
  write join(styles, '404.styl'), _404_STYL
  write join(styles, 'reset.styl'), RESET_STYL
  write join(styles, 'base.styl'), BASE_STYL
  write join(styles, 'ui.styl'), UI_STYL

  mkdir ui
  mkdir connectionAlert
  write join(connectionAlert, 'index.html'), CONNECTION_ALERT_HTML
  write join(connectionAlert, 'index.js'), CONNECTION_ALERT_JS
  write join(ui, 'index.js'), UI_JS

  if useCoffee
    mkdir appScripts
    write join(appScripts, 'index.coffee'), render(APP_COFFEE, {app})

    mkdir serverScripts
    write join(serverScripts, 'index.coffee'), render(SERVER_COFFEE, {app})
    write join(serverScripts, 'serverError.coffee'), render(SERVER_ERROR_COFFEE, {app})

    write join(dir, 'Makefile'), MAKEFILE_COFFEE
    write join(dir, '.gitignore'), GITIGNORE_COFFEE

  else
    mkdir appScripts
    write join(appScripts, 'index.js'), render(APP_JS, {app})

    mkdir serverScripts
    write join(serverScripts, 'index.js'), render(SERVER_JS, {app})
    write join(serverScripts, 'serverError.js'), render(SERVER_ERROR_JS, {app})
    
    write join(dir, '.gitignore'), GITIGNORE_JS

  write join(dir, 'server.js'), SERVER
  write join(dir, 'package.json'), packageJson(project, useCoffee)
  write join(dir, 'README.md'), render(README, {project})

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

  return logComplete()  if program.noinstall
  process.chdir dir
  console.log '\n  Installing dependencies. This may take a little while...'
  exec 'npm install', (err, stdout, stderr) ->
    return console.error stderr if err
    console.log stdout.replace /^|\n/g, '\n  '  if stdout
    logComplete()


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
