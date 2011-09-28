express = require 'express'
sink = require './sink'
app = express.createServer(
  express.favicon(),
  express.static(__dirname + '/public'),
  sink.router()
)

store = sink.createStore listen: app
store.flush()

app.listen 3000
console.log 'Go to http://localhost:3000/'
