http = require 'http'
express = require 'express'
hello = require './hello'

expressApp = express()
  .use(express.static __dirname + '/public')
  # Apps create an Express middleware
  .use(hello.router())

server = http.createServer(expressApp).listen 3000

# Apps also provide a server-side store for syncing data
hello.createStore listen: server
