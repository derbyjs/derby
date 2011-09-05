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
# Clear all data every time node server is started
store.flush()
newUserId = 0

app.get '/:room?', (req, res) ->
  # Redirect users to URLs that only contain letters, numbers, and hyphens
  room = req.params.room
  return res.redirect '/lobby' unless room && /^[-\w ]+$/.test room
  _room = room.toLowerCase().replace /[_ ]/g, '-'
  return res.redirect "/#{_room}" if _room != room
  
  # Get the userId from session data or select a new id if needed
  session = req.session
  userId = if typeof session.userId is 'number' then session.userId else
    session.userId = newUserId++

  # TODO: Limit user data subscription to users in the room. Maybe this could
  # be implied by an object ref on the room
  room = req.params.room
  store.subscribe _room: "rooms.#{room}.**", "users.**", (err, model) ->
    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []
    model.setNull "users.#{userId}",
      name: 'User ' + (userId + 1)
      picClass: 'pic' + (userId % NUM_USER_IMAGES)
    model.set '_session',
      userId: userId
      user: model.ref 'users', '_session.userId'
      newComment: ''
      numMessages: model.get('_room.messages').length

    chat.view.sendHtml res, model

app.listen 3003
console.log "Go to: http://localhost:3003/lobby"

