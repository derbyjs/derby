{get, ready, view} = app = require('derby').createApp module
{render} = require './shared'
require './live-css'
require './table'
require './leaderboard'
require './bindings-bench'

# Define a view helper function for use in templates
view.fn 'unspace', (s) -> s && s.replace /\s/g, ''

# View helper functions can have setters as well
view.fn 'capitalizeFirst',
  get: (s) -> s && s.charAt(0).toUpperCase() + s.slice(1)
  set: (s) -> [s.toLowerCase()]

get '/', (page, model) ->
  model.subscribe 'home', (err, home) ->
    home.setNull 'titleColor', 'black'
    home.setNull 'colors', [
      'Black'
      'Deep pink'
      'Lime green'
      'Coral'
      'Dark turquoise'
      'Dark orchid'
    ]
    render page, 'home'

['get', 'post', 'put', 'del'].forEach (method) ->
  app[method] '/submit', (page, model, {body, query}) ->
    args = JSON.stringify {method, body, query}, null, '  '
    render page, 'submit', {args}

get '/error', ->
  throw new Error 500

get '/back', (page) ->
  page.redirect 'back'


ready (model) ->
  model.set '_showReconnect', true
  exports.connect = ->
    # Hide the reconnect link for a second after clicking it
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()

  exports.reload = -> window.location.reload()
