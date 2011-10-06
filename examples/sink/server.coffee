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
  # Log errors in development only
  server.error (err, req, res, next) ->
    if err then console.log(if err.stack then err.stack else err)
    next err

server.error (err, req, res) ->
  ## Customize error handling here ##
  message = err.message || err.toString()
  status = parseInt message
  if status is 404 then res.send "Can't seem to find that page", 404
  else res.send if 400 <= status < 600 then status else 500

## Add server only routes here ##

server.all '*', (req) ->
  throw "404: #{req.url}"

store = sink.createStore listen: server
store.flush()

server.listen 3000
console.log 'Go to http://localhost:3000/'
