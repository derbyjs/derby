NUM_USER_IMAGES = 10
MAX_MESSAGES = 100
MAX_AGE_ONE_YEAR = {maxAge: 1000 * 60 * 60 * 24 * 365}

# dbUrl = (process.env.MONGODB_PATH || 'mongodb://127.0.0.1:27017') + '/chat'
# mongoStore = require 'connect-mongodb'
gzip = require 'connect-gzip'
express = require 'express'
app = express.createServer()

chat = require './chat.server'
store = chat.createStore listen: app
store.flush()
newUserId = 0

# Use Express to serve the image sprite and deal with session tracking
app.use gzip.staticGzip __dirname + '/public'
# app.use gzip.gzip()
# app.use express.cookieParser()
# app.use express.session
#   secret: 'dont_tell'
#   cookie: MAX_AGE_ONE_YEAR
#   store: new mongoStore {url: dbUrl}

app.get '/:room', (req, res) ->
  # If the client already has a session cookie with a userId set, use that.
  # Otherwise, set to a new ID value
  # session = req.session
    # session.userId = userId =
    #   if typeof session.userId is 'number' then session.userId else newUserId++
    # session.save()
  userId = newUserId++

  room = req.params.room
  store.subscribe _room: "rooms.#{room}.**", (err, model) ->
    model.setNull '_room.messages', []
    model.setNull "_room.users.#{userId}",
      name: 'User ' + (userId + 1)
      picClass: 'pic' + (userId % NUM_USER_IMAGES)
    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under that path is synced back to the server
    model.set '_session',
      userId: userId
      newComment: ''
    model.set '_user', model.ref "_room.users.#{userId}"

    chat.view.html model, (html) -> res.send html

app.listen 3001
console.log 'Go to: http://localhost:3001/lobby'
