# Derby exposes framework features on this module
{get, view, ready} = require('derby').createApp module

## ROUTES ##

NUM_USER_IMAGES = 10

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
  model.subscribe _room: "rooms.#{room}", 'users', ->

    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []

    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server.
    model.set '_newComment', ''
    model.set '_numMessages', model.get '_room.messages.length'
    model.ref '_user', "users.#{userId}"

    page.render()


## CONTROLLER FUNCTIONS ##

# "before" and "after" functions are called when the view is rendered in the
# browser. Note that they are not called on the server.
view.after 'message', -> $('messages').scrollTop = $('messageList').offsetHeight

ready (model) ->
  months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  displayTime = (time) ->
    time = new Date time
    hours = time.getHours()
    period = if hours < 12 then ' am, ' else ' pm, '
    hours = (hours % 12) || 12
    minutes = time.getMinutes()
    minutes = '0' + minutes if minutes < 10
    hours + ':' + minutes + period + months[time.getMonth()] +
      ' ' + time.getDate() + ', ' + time.getFullYear()

  # Display times are only set client-side, since the timezone is not known
  # when performing server-side rendering
  for message, i in model.get '_room.messages'
    messagePath = "_room.messages.#{i}"
    if time = model.get messagePath + '.time'
      model.set messagePath + '._displayTime', displayTime time


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

  model.on 'push', '_room.messages', (message, len) ->
    model.set '_numMessages', len
    model.set '_room.messages.' + (len - 1) + '._displayTime',
      displayTime message.time

  exports.postMessage = ->
    model.push '_room.messages',
      userId: model.get '_session.userId'
      comment: model.get '_newComment'
      time: +new Date

    model.set '_newComment', ''
