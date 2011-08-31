chat = module.exports = require './chat'
view = chat.view
fs = require 'fs'
stylus = require 'stylus'

# SERVER ONLY VIEW DEFINITION #
  
# There are a handful of reserved views: Doctype, Title, Head, Body, and Tail.
# These are rendered when the view.html function is called by the server.
# The rendering order is Doctype, Title, Head, Body, preLoad scripts,
# external JS, model and event initialization scripts, and then Tail.

fs.readFile "#{__dirname}/chat.styl", 'utf8', (err, styl) ->
  stylus.render styl, compress: true, (err, css) ->
    view.make 'Head', """
      <meta name=viewport content="width=device-width">
      <style>#{css}</style>
      """

# The Body and user defined views can be a function of multiple model objects.
# The template fields can be specified by an object literal or function that
# returns a similarly formatted object. The template must be a string of HTML,
# which is parsed when the view is created. Fields in double braces are
# escaped and fields in triple braces are not. Note that this template does
# not only specify the initial HTML rendering; bindings are also created to
# update the DOM when the model changes and update the model when certain
# user events occur.

# By default, user changes to input values update the model and model changes
# update the input unless the input has focus. "silent" is a special attribute
# that prevents the model from generating update events when the user edits
# an input field and overrides the input value even if it has focus.
view.make 'Body', """
  {{> info}}
  <div id=messages><ul id=messageList>{{_room.messages > message}}</ul></div>
  <div id=foot>
    <img id=inputPic src=img/s.png class={{_session.user.picClass}}>
    <div id=inputs>
      <input id=inputName value={{_session.user.name}}>
      <form id=inputForm onsubmit="return chat.postMessage()">
        <input id=commentInput value={{_session.newComment}} silent>
      </form>
    </div>
  </div>
  """

# Scripts required to properly render the document can be passed in an
# anonymous function to view.preLoad. For convenience, document.getElementById
# is aliased as $, but no other special functions are provided by default.
view.preLoad ->
  messages = $('messages')
  messageList = $('messageList')
  foot = $('foot')
  do window.onresize = ->
    messages.style.height = (window.innerHeight - foot.offsetHeight) + 'px'
    messages.scrollTop = messageList.offsetHeight
  $('commentInput').focus()
