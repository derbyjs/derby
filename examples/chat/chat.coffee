derby = require 'derby'
# This module's "module" and "exports" objects are passed to Derby, so that it
# can expose certain functions on this module for the server or client code.
{ready, model, view} = derby.createApp module, exports


# SERVER & CLIENT VIEW DEFINITION #

view.make 'Title', 'Chat ({{_session.numMessages}}) - {{_session.user.name}}'

# connected and canConnect are built-in properties of model. If a variable
# is not defined in the current context, it will be looked up in the model data
# and the model properties
view.make 'info', """
  <div id=info>{{^connected}}
    {{#canConnect}}
      Offline{{#_showReconnect}} 
        &ndash; <a href=# onclick="return chat.connect()">Reconnect</a>
      {{/}}
    {{^}}
      Unable to reconnect &ndash; 
      <a href=javascript:window.location.reload()>Reload</a>
    {{/}}
  {{/}}</div>
  """

# Parentheses can be used to do interpolation within a model name. 
view.make 'message', """
  <li><img src=img/s.png class={{users.(userId).picClass}} alt="">
    <div class=message>
      <p><b>{{users.(userId).name}}</b>
      <p>{{comment}}
    </div>
  """,
  # "Before" and "After" functions are called when the view is rendered in the
  # browser. Note that they are not called on the server.
  After: -> $('messages').scrollTop = $('messageList').offsetHeight


# CONTROLLER FUNCTIONS DEFINITION #

ready ->

  # Any path name that starts with an underscore is private to the current
  # client. Nothing set under a private path is synced back to the server
  model.set '_showReconnect', true
  exports.connect = ->
    # Hide the reconnect link for a second so it looks like something is going on
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()
    return false

  model.on 'push', '_room.messages', -> model.incr '_session.numMessages'

# Exported functions are exposed as a global in the browser with the same
# name as this module. This function is called by the form submission action.
exports.postMessage = ->
  model.push '_room.messages',
    userId: model.get '_session.userId'
    comment: model.get '_session.newComment'
  model.set '_session.newComment', ''
  return false

