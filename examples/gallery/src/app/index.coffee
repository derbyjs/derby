{get, view, ready} = require('derby').createApp module

get '/', (page, model) ->
  page.render()

