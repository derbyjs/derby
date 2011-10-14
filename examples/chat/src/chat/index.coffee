# Derby exposes framework features on this module
{get, view, ready} = require('derby').createApp module

## ROUTES ##

NUM_USER_IMAGES = 10

# hook.of '/:room?', unique: 'room',
#   connect: (model) ->
#     # The connect hook is called before the page is rendered on the server
#     # and whenever the client reconnects after being disconnected. It also
#     # runs on the client before a new unique route is rendered
#     userId = model.get '_session.userId'
#     model.set "_room.users.#{userId}", model.ref "users.#{userId}"
#   disconnect: (model) ->
#     # The disconnect hook only has access to items in _window and _session,
#     # because it runs on the server after the client disconnects. It also
#     # runs on the client when going between unique routes
#     model.del model.get '_window.roomUser'

get '/:room?', (page, model, {room}) ->
  # Redirect users to URLs that only contain letters, numbers, and hyphens
  return page.redirect '/lobby'  unless room && /^[-\w ]+$/.test room
  _room = room.toLowerCase().replace /[_ ]/g, '-'
  return page.redirect "/#{_room}"  if _room != room

  # Render page if a userId is already stored in session data
  if userId = model.get '_session.userId'
    return getRoom page, model, room, userId

  # Otherwise, select a new userId and initialize user
  model.async.incr 'nextUserId', (err, userId) ->
    model.set '_session.userId', userId
    model.set "users.#{userId}",
      name: 'User ' + userId
      picClass: 'pic' + (userId % NUM_USER_IMAGES)
    getRoom page, model, room, userId

getRoom = (page, model, room, userId) ->
  # Subscribe to everything set on this room as well as all of the user data
  # for each of the users in the room. Note that subscriptions don't follow
  # references unless explicitly included in the paths
  model.subscribe _room: "rooms.#{room}(,.users.*)", ->
    # This is set for use by the disconnect function, which only gets data
    # set on _window and _session
    model.set '_window.roomUser', "rooms.#{room}.users.#{userId}"
    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []

    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server.
    model.set '_user', model.ref "users.#{userId}"
    model.set '_newComment', ''
    model.set '_numMessages', model.get('_room.messages').length

    # Should be in connect hook:
    userId = model.get '_session.userId'
    model.set "_room.users.#{userId}", model.ref "users.#{userId}"

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
      userId: model.get '_session.userId'
      comment: model.get '_newComment'
    model.set '_newComment', ''
