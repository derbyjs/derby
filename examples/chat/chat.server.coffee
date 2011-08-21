chat = require './chat'
view = chat.view
fs = require 'fs'
stylus = require 'stylus'

# SERVER ONLY VIEW DEFINITION #
  
# There are a handful of reserved view names -- Title, Head, Body, and Foot.
# These are rendered when the view.html function is called by the server.
# The rendering order is doctype, Title, Head, Body, preLoad scripts,
# external JS, model and event initialization scripts, and then Foot.
  
# There are a few ways to specifiy views. The Title must be a simple view,
# which means that it is tied to the value of one model object, a string,
# or a function that returns a string.
view.make 'Title', model: '_session.title'

# Head and Foot are typically simple views that output a string.
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
# not only specify the initial HTML rendering; event handlers are created to
# update the DOM when the model changes and update the model when certain
# user events occur.
view.make 'Body',
    # A field can be output by another view function tied to a model object.
    # If the model object is an array, the view function will be called for
    # each item in the array, and the outputs will be concatenated together.
    messages: {model: '_room.messages', view: 'message'}
    userPicClass: {model: '_session.user.picClass'}
    userName: {model: '_session.user.name'}
    newComment: {model: '_session.newComment'}
  , """
  <div id=messageContainer><ul id=messageList>{{{messages}}}</ul></div>
  <div id=foot>
    <img id=inputPic src=#{SPRITE_URL} class={{{userPicClass}}}>
    <div id=inputs>
      <!-- By default, user changes to input values update the model. -->
      <input id=inputName value={{userName}}>
      <form id=inputForm action="javascript:return chat.postMessage()">
        <!-- "silent" is a special attribute that prevents the model from
        generating update events when the user edits an input field. Thus,
        the model is updated but not synced with the server or view. -->
        <input id=commentInput value={{newComment}} silent>
      </form>
    </div>
  </div>
  """
  
# Scripts required to properly render the document can be passed in an
# anonymous function to view.preLoad. These scripts will be executed before
# any external scripts are downloaded, so they will typically happen before
# the browser paints. For conciseness, document.getElementById is aliased
# as $, but no other special functions are provided by default.
view.preLoad ->
  container = $('messageContainer')
  foot = $('foot')
  messageList = $('messageList')
  do window.onresize = ->
    container.style.height = (window.innerHeight - foot.offsetHeight) + 'px'
    container.scrollTop = messageList.offsetHeight
  $('commentInput').focus()