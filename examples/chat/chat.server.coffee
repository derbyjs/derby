chat = module.exports = require './chat'
view = chat.view
fs = require 'fs'
stylus = require 'stylus'


# SERVER ONLY VIEW DEFINITION #

# There are a handful of reserved views: Doctype, Title, Head, Body, and Tail.
# These are rendered when the view.sendHtml function is called by the server.
fs.readFile "#{__dirname}/chat.styl", 'utf8', (err, styl) ->
  stylus.render styl, compress: true, (err, css) ->
    view.make 'Head', """
      <meta name=viewport content="width=device-width">
      <style>#{css}</style>
      """

# Derby templates are very similar to Mustache, except there are a few
# modifications to make them work directly with models. Unlike other templating
# languages, Derby parses the HTML and infers bindings from context. Thus,
# a simple HTML template defines the HTML output, the event handlers that
# update the model after user interaction, and the event handlers that update
# the DOM when the model changes.
view.make 'Body', """
  {{> info}}
  <div id=messages><ul id=messageList>{{_room.messages > message}}</ul></div>
  <div id=foot>
    <img id=inputPic src=img/s.png class={{_session.user.picClass}} alt="">
    <div id=inputs>
      <input id=inputName value={{_session.user.name}}>
      <form id=inputForm x-bind=submit:postMessage>
        <input id=commentInput value={{_session.newComment}} x-silent autofocus>
      </form>
    </div>
  </div>
  """

# Scripts required to properly render the page can be passed in a function
# to view.preLoad. For convenience, document.getElementById is aliased as $,
# but no other special functions are provided by default.
view.preLoad ->
  messages = $ 'messages'
  messageList = $ 'messageList'
  foot = $ 'foot'
  commentInput = $ 'commentInput'
  do window.onresize = ->
    messages.style.height = (window.innerHeight - foot.offsetHeight) + 'px'
    messages.scrollTop = messageList.offsetHeight
  commentInput.focus()  unless 'autofocus' of commentInput

