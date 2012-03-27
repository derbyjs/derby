path = require 'path'
express = require 'express'
derby = require 'derby'
gzip = require 'connect-gzip'
app = require '../app'
flickr = require './flickr'


## SERVER CONFIGURATION ##

MAX_AGE_ONE_YEAR = maxAge: 1000 * 60 * 60 * 24 * 365
root = path.dirname path.dirname __dirname
publicPath = path.join root, 'public'
staticPages = derby.createStatic root

(module.exports = server = express.createServer())
  # The express.static middleware can be used instead of gzip.staticGzip
  .use(gzip.staticGzip publicPath, MAX_AGE_ONE_YEAR)
  .use(express.favicon())

  # Uncomment to add form data parsing support
  # .use(express.bodyParser())
  # .use(express.methodOverride())

  # Uncomment and supply secret to add Derby session handling
  # Derby session middleware creates req.model and subscribes to _session
  # .use(express.cookieParser())
  # .use(express.session(secret: '', cookie: MAX_AGE_ONE_YEAR))
  # .use(app.session())

  # Remove to disable dynamic gzipping
  .use(gzip.gzip())

  # The router method creates an express middleware from the app's routes
  .use(app.router())
  .use(server.router)


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

store = app.createStore listen: server

flickr.setup store, key: '86958e03c183fcb1b7fddfeb19f3a423'
