http = require 'http'
path = require 'path'
express = require 'express'
gzippo = require 'gzippo'
derby = require 'derby'
app = require '../app'
flickr = require './flickr'
serverError = require './serverError'


## SERVER CONFIGURATION ##

ONE_YEAR = 1000 * 60 * 60 * 24 * 365
root = path.dirname path.dirname __dirname
publicPath = path.join root, 'public'

(expressApp = express())
  .use(express.favicon())
  # Gzip static files and serve from memory
  .use(gzippo.staticGzip publicPath, maxAge: ONE_YEAR)

  # Gzip dynamically rendered content
  .use(express.compress())

  # Uncomment to add form data parsing support
  # .use(express.bodyParser())
  # .use(express.methodOverride())

  # Uncomment and supply secret to add Derby session handling
  # Derby session middleware creates req.model and subscribes to _session
  # .use(express.cookieParser 'secret_sauce')
  # .use(express.session cookie: {maxAge: ONE_YEAR})
  # .use(app.session())

  # The router method creates an express middleware from the app's routes
  .use(app.router())
  .use(expressApp.router)
  .use(serverError root)

module.exports = server = http.createServer expressApp


## SERVER ONLY ROUTES ##

expressApp.all '*', (req) ->
  throw "404: #{req.url}"


## STORE SETUP ##

app.createStore listen: server

flickr.setup store, key: '86958e03c183fcb1b7fddfeb19f3a423'
