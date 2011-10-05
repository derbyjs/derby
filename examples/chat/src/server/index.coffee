path = require 'path'
express = require 'express'
gzip = require 'connect-gzip'
chat = require '../chat'

MAX_AGE_ONE_YEAR = {maxAge: 1000 * 60 * 60 * 24 * 365}
root = path.dirname path.dirname __dirname

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
  # Log stack traces in development only
  server.error (err, req, res, next) ->
    console.log err.stack  if err && err.stack
    next err

server.error (err, req, res) ->
  ## Add custom error handling here ## 
  switch err.message
    when '404' then res.send "Can't seem to find that page.", 404
    else res.send if (code = +err.message) && 400 <= code < 600 then code else 500

## Add server only routes here ##

server.all '*', ->
  throw new Error 404

store = chat.createStore redis: {db: 3}, listen: server
# Clear all data every time node server is started
store.flush()

server.listen 3003
console.log "Go to: http://localhost:3003/lobby"
