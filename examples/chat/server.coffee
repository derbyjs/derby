NUM_USER_IMAGES = 10
MAX_AGE_ONE_YEAR = {maxAge: 1000 * 60 * 60 * 24 * 365}

gzip = require 'connect-gzip'
express = require 'express'
app = express.createServer()
  .use(gzip.staticGzip __dirname + '/public', MAX_AGE_ONE_YEAR)
  .use(express.favicon())
  .use(express.cookieParser())
  .use(express.session secret: 'dont_tell')
  .use(gzip.gzip())

chat = require './chat.server'
store = chat.createStore redis: {db: 3}, listen: app
store.flush()
newUserId = 0

app.get '/:room?', (req, res) ->
  # Redirect users to URLs that only contain letters, numbers, and hyphens
  room = req.params.room
  return res.redirect '/lobby' unless room && /^[-\w ]+$/.test room
  _room = room.toLowerCase().replace /[_ ]/g, '-'
  return res.redirect "/#{_room}" if _room != room
  
  # If the client already has a session cookie with user info, use that.
  # Otherwise, initialize a new user
  session = req.session
  user = if session.user then session.user else session.user =
    userId: userId = newUserId++
    name: 'User ' + (userId + 1)
    picClass: 'pic' + (userId % NUM_USER_IMAGES)

  room = req.params.room
  store.subscribe _room: "rooms.#{room}.**", (err, model) ->
    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []
    model.setNull "_room.users.#{user.userId}", user
    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server
    model.set '_session',
      userId: user.userId
      user: model.ref '_room.users', '_session.userId'
      newComment: ''
      numMessages: model.get('_room.messages').length

    chat.view.sendHtml res, model

app.listen 3003
console.log "Go to: http://localhost:3003/lobby"

