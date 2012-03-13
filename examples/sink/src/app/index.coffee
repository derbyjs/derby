{get} = app = require('derby').createApp module
{render} = require './shared'
require './live-css'
require './table'

get '/', (page) ->
  render page, 'home'

['get', 'post', 'put', 'del'].forEach (method) ->
  app[method] '/submit', (page, model, {body, query}) ->
    args = JSON.stringify {method, body, query}, null, '  '
    render page, 'submit', {args}

get '/error', ->
  throw new Error 500

get '/back', (page) ->
  page.redirect 'back'
