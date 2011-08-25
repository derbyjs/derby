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
  
  # If the client already has a session cookie with a userId set, use that.
  # Otherwise, set to a new ID value
  session = req.session
  session.userId = userId =
    if typeof session.userId is 'number' then session.userId else newUserId++

  room = req.params.room
  store.subscribe _room: "rooms.#{room}.**", (err, model) ->
    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []
    model.setNull "_room.users.#{userId}",
      name: 'User ' + (userId + 1)
      picClass: 'pic' + (userId % NUM_USER_IMAGES)
    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under that path is synced back to the server
    model.set '_session',
      userId: userId
      user: model.ref '_room.users', '_session.userId'
      newComment: ''
      title: 'Chat'
    
    # TODO: Make title update when Racer supports model functions
    # model.set '_session.title', model.fn ['messages', '_session.user.name'],
    #   (messages, userName) -> "Chat (#{messages.length}) - #{userName}"

    chat.view.html model, (html) -> res.send html

app.listen 3003
console.log "Go to: http://localhost:3003/lobby"

