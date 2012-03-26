{isProduction} = require 'racer/lib/util'
files = require './files'
refresh = module.exports = require './refresh'

refresh.cssError = cssError = (err) ->
  console.error '\nCSS PARSE ERROR\n' + err.stack
  return err.stack

refresh.templateError = templateError = (err) ->
  console.error '\nTEMPLATE ERROR\n' + err.stack
  return err.stack

appHashes = {}
refresh.autoRefresh = (store, options, view) ->
  return if isProduction || store._derbySocketsSetup
  view._appHashes = appHashes
  store._derbySocketsSetup = true
  listeners = {}
  store.sockets.on 'connection', (socket) ->
    socket.on 'derbyClient', (appFilename, callback) ->
      return unless appFilename

      # TODO: Wait for appHash to be set if it is undefined
      callback appHashes[appFilename]

      if listeners[appFilename]
        return listeners[appFilename].push socket

      sockets = listeners[appFilename] = [socket]
      addWatches appFilename, options, sockets, view

addWatches = (appFilename, options, sockets, view) ->
  {root, clientName} = files.parseName appFilename, options

  files.watch root, 'css', ->
    files.css root, clientName, false, (err, css) ->
      if err
        errText = cssError err
        css = ''
      for socket in sockets
        socket.emit 'refreshCss', errText, css

  files.watch root, 'html', ->
    files.templates root, clientName, (err, templates, instances) ->
      if err
        errText = templateError err
        templates = {}
        instances = {}
      view.clear()
      view._makeAll templates, instances
      for socket in sockets
        socket.emit 'refreshHtml', errText, templates, instances

  files.watch root, 'js', ->
    process.send type: 'reload'
