http = require 'http'
path = require 'path'
express = require 'express'
gzippo = require 'gzippo'
MongoStore = require('connect-mongo')(express)
derby = require 'derby'
chat = require '../chat'
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

  # Derby session middleware creates req.model and subscribes to _session
  .use(express.cookieParser 'secret_sauce')
  .use(express.session
    cookie: {maxAge: ONE_YEAR}
    store: new MongoStore(db: 'derby-chat', collection: 'express-sessions')
  )
  .use(chat.session())

  # The router method creates an express middleware from the app's routes
  .use(chat.router())
  .use(expressApp.router)
  .use(serverError root)

module.exports = server = http.createServer expressApp


## SERVER ONLY ROUTES ##

expressApp.all '*', (req) ->
  throw "404: #{req.url}"


## STORE SETUP ##

derby.use(require 'racer-db-mongo')

chat.createStore
  listen: server
  db: {type: 'Mongo', uri: 'mongodb://localhost/derby-chat'}
