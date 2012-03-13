{get} = app = require('derby').createApp module
{ctxFor} = require './shared'
require './live-css'
require './table'

get '/', (page) ->
  page.render ctxFor 'home'

['get', 'post', 'put', 'del'].forEach (method) ->
  app[method] '/submit', (page, model, {body, query}) ->
    args = JSON.stringify {method, body, query}, null, '  '
    page.render ctxFor 'submit', {args}

get '/error', ->
  throw new Error 500

get '/back', (page) ->
  page.redirect 'back'
