Route = require 'express/lib/router/route'
racer = require 'racer'
derbyModel = require './derby.Model'
Dom = require './Dom'
View = require './View'
History = require './History'

Page = (@view, @model) -> return
Page:: =
  render: (ctx) ->
    @view.render @model, ctx
  redirect: (url) ->
    return @view.history.back()  if url is 'back'
    # TODO: Add support for `basepath` option like Express
    url = '\\'  if url is 'home'
    @view.history.replace url, true

exports.createApp = (appModule) ->
  appExports = appModule.exports
  # Expose methods on the application module
  appExports.view = view = new View
  model = view.model = racer.model
  dom = view.dom = new Dom model, appExports
  derbyModel.init model, dom

  routes = {}
  ['get', 'post', 'put', 'del'].forEach (method) ->
    queue = routes[method] = []
    appExports[method] = (pattern, callback) ->
      queue.push new Route method, pattern, callback
  page = new Page view, model
  history = view.history = new History routes, page, dom

  appExports.ready = (fn) -> racer.onready = -> fn model

  # "$$templates$$" is replaced with an array of templates in View.server
  for name, template of "$$templates$$"
    view.make name, template

  appModule.exports = (modelBundle, appHash, ctx, appFilename) ->
    model.on 'initialized', ->
      view.render model, ctx, true
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
