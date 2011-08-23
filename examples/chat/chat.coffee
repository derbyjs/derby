derby = require 'derby'
# This module's "module" and "exports" objects are passed to Derby, so that it
# can expose certain functions on this module for the server or client code.
{model, view} = derby.createApp module, exports

# MODEL FUNCTION DEFINITION #

# Model functions must be defined on both the server and client, since only
# the name of the model function is stored in the model itself. The inputs to
# model functions are defined via an array of names. The function is called
# with their values as arguments after any of the inputs are modified.
# model.fn 'title', ['messages', '_session.user.name'],
  # (messages, userName) -> "Chat (#{messages.length}) - #{userName}"


# SERVER & CLIENT VIEW DEFINITION #

# This is an example of a custom view. Since it is bound to an array, each item
# in the array is passed as an argument.
view.make 'message', (item) ->
    userPicClass: {model: "_room.users.#{item.userId}.picClass"}
    userName: {model: "_room.users.#{item.userId}.name"}
    comment: item.comment
  , """
  <li><img src=img/s.png class={{{userPicClass}}}>
    <div class=message>
      <p><b>{{userName}}</b>
      <p>{{comment}}
    </div>
  """
    # The "after" option specifies a function to execute after the view is
    # rendered. If a view that has an after function is rendered on the server,
    # the after function will be added to the preLoad functions.
  , after: -> $('messageContainer').scrollTop = $('messageList').offsetHeight


# USER FUNCTIONS DEFINITION #

# Exported functions are exposed as a global in the browser with the same
# name as this module. This function is called by the form submission action.
exports.postMessage = ->
  model.push '_room.messages',
    userId: model.get '_session.userId'
    comment: model.get '_session.newComment'
  model.set '_session.newComment', ''
  return false
