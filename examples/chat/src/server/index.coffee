path = require 'path'
express = require 'express'
gzip = require 'connect-gzip'
chat = require '../chat'

MAX_AGE_ONE_YEAR = {maxAge: 1000 * 60 * 60 * 24 * 365}
root = path.dirname path.dirname __dirname

app = express.createServer(
  gzip.staticGzip(root + '/public', MAX_AGE_ONE_YEAR),
  express.favicon(),
  express.cookieParser(),
  express.session(secret: 'dont_tell', cookie: MAX_AGE_ONE_YEAR),
  # Derby session middleware subscribes models to _session
  chat.session(),
  # The routes method creates an express middleware from the app's routes
  chat.router(),
  gzip.gzip()
)

store = chat.createStore redis: {db: 3}, listen: app
# Clear all data every time node server is started
store.flush()

app.listen 3003
console.log "Go to: http://localhost:3003/lobby"
