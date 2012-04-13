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

getRoom = (page, model, roomName, userId) ->
  model.subscribe "rooms.#{roomName}", 'users', (err, room) ->
    model.ref '_room', room

    # setNull will set a value if the object is currently null or undefined
    model.setNull '_room.messages', []

    # Any path name that starts with an underscore is private to the current
    # client. Nothing set under a private path is synced back to the server.
    model.set '_newComment', ''
    model.ref '_user', "users.#{userId}"
    model.fn '_numMessages', '_room.messages', (messages) -> messages.length

    page.render()


## CONTROLLER FUNCTIONS ##

ready (model) ->
  months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  displayTime = (time) ->
    time = new Date time
    hours = time.getHours()
    period = if hours < 12 then ' am, ' else ' pm, '
    hours = (hours % 12) || 12
    minutes = time.getMinutes()
    minutes = '0' + minutes if minutes < 10
    return hours + ':' + minutes + period + months[time.getMonth()] +
      ' ' + time.getDate() + ', ' + time.getFullYear()

  # Display times are only set client-side, since the timezone is not known
  # when performing server-side rendering
  for message, i in model.get '_room.messages'
    # _displayTime starts with an underscore so that its value is not
    # stored or sent to other clients
    model.set "_room.messages.#{i}._displayTime", displayTime message.time


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


  messages = document.getElementById 'messages'
  messageList = document.getElementById 'messageList'
  atBottom = true

  # Derby emits pre mutator events after the model has been updated, but
  # before the view bindings have been updated
  model.on 'pre:push', '_room.messages', ->
    # Check to see if the page is scrolled to the bottom before adding
    # a new message
    bottom = messageList.offsetHeight
    containerHeight = messages.offsetHeight
    scrollBottom = messages.scrollTop + containerHeight
    atBottom = bottom < containerHeight || scrollBottom == bottom

  # Regular model mutator events are emitted after both the model and view
  # bindings have been updated
  model.on 'push', '_room.messages', (message, len, isLocal) ->
    # Scoll page when adding a message or when another user adds a message
    # and the page is already at the bottom
    if isLocal || atBottom
      messages.scrollTop = messageList.offsetHeight
    # Update display time using local timezone
    model.set "_room.messages.#{len - 1}._displayTime", displayTime message.time


  exports.postMessage = ->
    model.push '_room.messages',
      userId: model.get '_session.userId'
      comment: model.get '_newComment'
      time: +new Date

    model.set '_newComment', ''
