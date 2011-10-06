path = require 'path'
express = require 'express'
derby = require 'derby'
gzip = require 'connect-gzip'
chat = require '../chat'

MAX_AGE_ONE_YEAR = {maxAge: 1000 * 60 * 60 * 24 * 365}
root = path.dirname path.dirname __dirname
static = derby.createStatic root

(server = express.createServer())
  .use(gzip.staticGzip(root + '/public', MAX_AGE_ONE_YEAR))
  .use(express.favicon())
  .use(express.cookieParser())
  .use(express.session(secret: 'dont_tell', cookie: MAX_AGE_ONE_YEAR))
  # Derby session middleware creates req.model and subscribes to _session
  .use(chat.session())
  # The router method creates an express middleware from the app's routes
  .use(chat.router())
  .use(server.router)
  .use(gzip.gzip())

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

## Add server only routes here ##

server.all '*', (req) ->
  throw "404: #{req.url}"

store = chat.createStore redis: {db: 3}, listen: server
# Clear all data every time node server is started
store.flush()

server.listen 3003
console.log "Go to: http://localhost:3003/lobby"
