express = require 'express'
sink = require './sink'
app = express.createServer(
  express.favicon(),
  express.static(__dirname + '/public')
)

store = sink.createStore listen: app
store.flush()

app.get '/', (req, res) ->
  store.subscribe 'x.**', (err, model) ->
    model.setNull 'x.styles', [
      {prop: 'color', value: '#c00', active: true}
      {prop: 'font-weight', value: 'bold', active: true}
      {prop: 'font-size', value: '18px', active: false}
    ]
    sink.send res, model

app.listen 3000
console.log 'Go to http://localhost:3000/'
