exports.setup = (library) ->
  library.view.fn 'sentenceCase', (text) ->
    text && text.charAt(0).toUpperCase() + text.slice(1)

exports.reconnect = ->
  # Hide the reconnect link for a second after clicking it
  @model.set 'hideReconnect', true
  setTimeout =>
    @model.set 'hideReconnect', false
  , 1000
  @model.reconnect()

exports.reload = ->
  window.location.reload()
