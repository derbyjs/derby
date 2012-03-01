express = require 'express'
hello = require './hello'
server = express.createServer()
  .use(express.static __dirname + '/public')
  # Apps create an Express middleware
  .use(hello.router())

# Apps also provide a server-side store for syncing data
hello.createStore listen: server

server.listen 3000
