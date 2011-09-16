# This module's "module" and "exports" objects are passed to Derby, so that it
# can expose certain functions on this module for the server or client code.
{ready, model, view} = require('derby').createApp module, exports


# CONTROLLER FUNCTIONS DEFINITION #

# "before" and "after" functions are called when the view is rendered in the
# browser. Note that they are not called on the server.
view.after 'message', -> $('messages').scrollTop = $('messageList').offsetHeight

ready ->
  # Exported functions are exposed as a global in the browser with the same
  # name as the module that includes Derby. They can also be bound to DOM
  # events using the "bind" attribute in a template.

  # Any path name that starts with an underscore is private to the current
  # client. Nothing set under a private path is synced back to the server
  model.set '_showReconnect', true
  exports.connect = ->
    # Hide the reconnect link for a second after clicking it
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()

  exports.reload = -> window.location.reload()

  model.on 'push', '_room.messages', -> model.incr '_session.numMessages'
  exports.postMessage = ->
    model.push '_room.messages',
      userId: model.get '_session.userId'
      comment: model.get '_session.newComment'
    model.set '_session.newComment', ''

