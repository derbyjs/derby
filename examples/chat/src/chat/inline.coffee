# Scripts required to properly render the page can be put in a file called
# "inline.coffee". This file will be automatically inserted before the external
# scripts are included.

# For convenience, document.getElementById is aliased as $, but no other
# special functions are provided by default.

messages = $ 'messages'
messageList = $ 'messageList'
foot = $ 'foot'
commentInput = $ 'commentInput'
do window.onresize = ->
  messages.style.height = (window.innerHeight - foot.offsetHeight) + 'px'
  messages.scrollTop = messageList.offsetHeight
# Use HTML5 autofocus if supported. Otherwise, focus manually
commentInput.focus()  unless 'autofocus' of commentInput
