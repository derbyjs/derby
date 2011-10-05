express = require 'express'
sink = require './sink'

server = express.createServer(
  express.favicon(),
  express.static(__dirname + '/public'),
  express.bodyParser(),
  sink.router()
)

store = sink.createStore listen: server
store.flush()

server.listen 3000
console.log 'Go to http://localhost:3000/'
