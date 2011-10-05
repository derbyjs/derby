express = require 'express'
sink = require './sink'

(server = express.createServer())
  .use(express.favicon())
  .use(express.static(__dirname + '/public'))
  .use(express.bodyParser())
  .use(express.methodOverride())
  .use(sink.router())
  .use(server.router)

server.configure 'development', ->
  # Log stack traces in development only
  server.error (err, req, res, next) ->
    console.log err.stack  if err && err.stack
    next err

server.error (err, req, res) ->
  ## Add custom error handling here ## 
  switch err.message
    when '404' then res.send "Can't seem to find that page.", 404
    else res.send if (code = +err.message) && 400 <= code < 600 then code else 500

## Add server only routes here ##

server.all '*', ->
  throw new Error 404

store = sink.createStore listen: server
store.flush()

server.listen 3000
console.log 'Go to http://localhost:3000/'
