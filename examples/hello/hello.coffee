{view, get} = require('derby').createApp module

# Templates define both HTML and model <- -> view bindings
view.make 'Body', 'Holler: <input value="{message}"><h2>{message}</h2>'

# Routes render on client as well as server
get '/', (page, model) ->
  # Subscribe specifies the data to sync
  model.subscribe 'message', ->
    page.render()
