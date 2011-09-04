derby = require 'derby'
# This module's "module" and "exports" objects are passed to Derby, so that it
# can expose certain functions on this module for the server or client code.
{ready, model, view} = derby.createApp module, exports


# SERVER & CLIENT VIEW DEFINITION #

view.make 'Title', 'Chat ({{_session.numMessages}}) - {{_session.user.name}}'

# Context object names starting with a capital letter are reserved. They are
# used for built-in properties of model.
view.make 'info', """
  <div id=info>{{^Connected}}
    {{#CanConnect}}
      Offline<span id=reconnect> &ndash; 
      <a href=# onclick="return chat.connect()">Reconnect</a></span>
    {{^}}
      Unable to reconnect &ndash; 
      <a href=javascript:window.location.reload()>Reload</a>
    {{/}}
  {{/}}</div>
  """

view.make 'message', """
  <li><img src=img/s.png class={{users.(userId).picClass}} alt="">
    <div class=message>
      <p><b>{{users.(userId).name}}</b>
      <p>{{comment}}
    </div>
  """,
  # "Before" and "After" options specify a function to execute before or after
  # the view is rendered. If rendered on the server, these functions will be
  # added to the preLoad functions
  After: -> $('messages').scrollTop = $('messageList').offsetHeight


# CONTROLLER FUNCTIONS DEFINITION #

ready ->
  model.on 'push', '_room.messages', -> model.incr '_session.numMessages'

# Exported functions are exposed as a global in the browser with the same
# name as this module. This function is called by the form submission action.
exports.postMessage = ->
  model.push '_room.messages',
    userId: model.get '_session.userId'
    comment: model.get '_session.newComment'
  model.set '_session.newComment', ''
  return false
