# This module's "module" and "exports" objects are passed to Derby, so that it
# can expose certain functions on this module for the server or client code.
{get, view, ready} = require('derby').createApp module, exports

## ROUTES ##

NUM_USER_IMAGES = 10

get '/:room?', (page, model, {room}) ->
  console.log room
  # Redirect users to URLs that only contain letters, numbers, and hyphens
  return page.redirect '/lobby'  unless room && /^[-\w ]+$/.test room
  _room = room.toLowerCase().replace /[_ ]/g, '-'
  return page.redirect "/#{_room}"  if _room != room

  # Get the userId from session data or select a new id if needed
  userId = model.get '_session.userId'
  return getRoom model, room, userId  if userId?
  # Model setter methods can be used in a synchronous or asychronous manner.
  # The sync method will return a value based on the current model, and the
  # async method will not callback until the server has responded
  model.set 'stuff', 1
  model.incr 'nextUserId', (err, path, userId) ->
    console.log userId
    model.set '_session.userId', userId
    getRoom page, model, room, userId

getRoom = (page, model, room, userId) ->
  # TODO: Limit user data subscription to users in the room. Maybe this could
  # be implied by an object ref on the room
  model.subscribe _room: "rooms.#{room}.**", "users.**", ->
    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []
    model.setNull "users.#{userId}",
      name: 'User ' + userId
      picClass: 'pic' + (userId % NUM_USER_IMAGES)
    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server
    model.set '_userId', userId
    model.set '_user', model.ref 'users', '_userId'
    model.set '_newComment', ''
    model.set '_numMessages', model.get('_room.messages').length
    page.render()


# CONTROLLER FUNCTIONS #

# "before" and "after" functions are called when the view is rendered in the
# browser. Note that they are not called on the server.
view.after 'message', -> $('messages').scrollTop = $('messageList').offsetHeight

ready (model) ->
  # Exported functions are exposed as a global in the browser with the same
  # name as the module that includes Derby. They can also be bound to DOM
  # events using the "x-bind" attribute in a template.
  model.set '_showReconnect', true
  exports.connect = ->
    # Hide the reconnect link for a second after clicking it
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()

  exports.reload = -> window.location.reload()

  model.on 'push', '_room.messages', -> model.incr '_numMessages'

  exports.postMessage = ->
    model.push '_room.messages',
      userId: model.get '_userId'
      comment: model.get '_newComment'
    model.set '_newComment', ''
