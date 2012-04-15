path = require 'path'
express = require 'express'
derby = require 'derby'
gzip = require 'connect-gzip'
chat = require '../chat'
MongoStore = require('connect-mongo')(express)


## SERVER CONFIGURATION ##

MAX_AGE_ONE_YEAR = maxAge: 1000 * 60 * 60 * 24 * 365
root = path.dirname path.dirname __dirname
publicPath = path.join root, 'public'
staticPages = derby.createStatic root

(module.exports = server = express.createServer())
  # The express.static middleware can be used instead of gzip.staticGzip
  .use(gzip.staticGzip publicPath, MAX_AGE_ONE_YEAR)
  .use(express.favicon())

  # Derby session middleware creates req.model and subscribes to _session
  .use(express.cookieParser())
  .use(express.session
    secret: 'dont_tell'
    cookie: MAX_AGE_ONE_YEAR
    store: new MongoStore(db: 'derby-chat', collection: 'express_sessions')
  )
  .use(chat.session())

  # Remove to disable dynamic gzipping
  .use(gzip.gzip())

  # The router method creates an express middleware from the app's routes
  .use(chat.router())
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

derby.use(require 'racer-db-mongo')

chat.createStore
  listen: server
  db: {type: 'Mongo', uri: 'mongodb://localhost/derby-chat'}
