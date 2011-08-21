  dom = exports.dom = require './dom'
  Model = require './Model'
  model = exports.model = new Model()
  view = exports.view = require './view'
  _ = exports.utils = require './utils'

module.exports = (parentModule, parentExports) ->

  dom._link model, view
  model._link dom
  view._link dom, model
  
  if _.onServer
    parentExports.dom = dom
    parentExports.model = model
    parentExports.view = view
    parentModule.exports = (app, dbUrl) ->
      browserify = require('browserify')
      path = require('path')
      clientDir = path.dirname(parentModule.filename)
      js = browserify(
        base: clientDir
        require: 'vers'
        staticRoot: path.dirname(clientDir)
        coffee: false
        builtins: false
        filter: _.minify
      )
      db = require('./db')(dbUrl, model, parentExports)
      io = require('socket.io')
      socket = io.listen(app, transports: [ 'websocket', 'xhr-polling' ])
      model._setDb db
      model._setSocket socket
      view._setClientName path.basename(parentModule.filename, '.js')
      view._setJsFile js.filename
      app.use js.middleware
      parentExports
  
  else
    parentModule.exports = (count, modelData, modelEvents, domEvents) ->
      io = require('./socket.io')
      socket = new io.Socket(null)
      model._setSocket socket
      view.init count
      model.init modelData, modelEvents
      dom.init domEvents
      parentExports
  exports
