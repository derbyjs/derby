racer = require 'racer'
derbyModel = require './derby.Model'
Dom = require './Dom'
View = require './View'
History = require './History'
{addHttpMethods, Page} = require './routes'

exports.createApp = (appModule) ->
  appExports = appModule.exports
  # Expose methods on the application module
  appExports.view = view = new View

  routes = addHttpMethods appExports

  appExports.ready = (fn) -> racer.on 'ready', fn

  # "$$templates$$" is replaced with an array of templates in View.server
  for name, template of "$$templates$$"
    view.make name, template

  appModule.exports = (modelBundle, appHash, ns, ctx, appFilename) ->
    # The init event is fired after the model data is initialized but
    # before the socket object is set
    racer.on 'init', (model) ->
      view.model = model
      view.dom = dom = new Dom model, appExports
      derbyModel.init model, dom
      page = new Page view, model
      history = view.history = new History page, routes, dom
      view.render model, ns, ctx, true

    # The ready event is fired after the model data is initialized and
    # the socket object is set
    racer.on 'ready', (model) ->
      autoRefresh view, model, appFilename, appHash

    racer.init modelBundle
    return appExports

  return appExports

autoRefresh = (view, model, appFilename, appHash) ->
  return unless appFilename

  {socket} = model
  model.on 'connectionStatus', (connected, canConnect) ->
    window.location.reload true  unless canConnect

  socket.on 'connect', ->
    socket.emit 'derbyClient', appFilename, (serverHash) ->
      window.location.reload true  if appHash != serverHash

  socket.on 'refreshCss', (css) ->
    el = document.getElementById '$_css'
    el.innerHTML = css  if el

  socket.on 'refreshHtml', (templates) ->
    for name, template of templates
      view.make name, template
    view.history.refresh()
