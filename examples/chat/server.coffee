NUM_USER_IMAGES = 10
MAX_AGE_ONE_YEAR = {maxAge: 1000 * 60 * 60 * 24 * 365}

gzip = require 'connect-gzip'
express = require 'express'
app = express.createServer(
  express.favicon(),
  gzip.staticGzip(__dirname + '/public', MAX_AGE_ONE_YEAR),
  gzip.gzip(),
  express.cookieParser(),
  express.session(secret: 'dont_tell')
)

chat = require './chat.server'
store = chat.createStore listen: app
store.flush()
newUserId = 0

app.get '/:room', (req, res) ->
  # If the client already has a session cookie with a userId set, use that.
  # Otherwise, set to a new ID value
  session = req.session
  console.log session.userId
  session.userId = userId = if typeof session.userId is 'number'
      session.userId
    else newUserId++
  # session.save()
  console.log session.userId

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

    chat.view.html model, (html) ->
      console.log req.session
      console.log res.writeHead.toString()
      res.send html

app.listen 3001
console.log 'Go to: http://localhost:3001/lobby'

