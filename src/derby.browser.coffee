racer = require 'racer'
modelHelper = require './modelHelper'
Dom = require './Dom'
View = require './View'
History = require './History'
Route = require 'express/lib/router/route'

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
  modelHelper.init model, dom

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

  appModule.exports = (modelBundle, ctx, appFilename) ->
    model.on 'initialized', ->
      view.render model, ctx, true
      autoRefresh view, model.socket, appFilename
    racer.init modelBundle
    return appExports

  return appExports

autoRefresh = (view, socket, appFilename) ->
  return unless appFilename

  socket.on 'connect', ->
    socket.emit 'derbyClient', appFilename

  socket.on 'refreshCss', (css) ->
    el = document.getElementById '$_css'
    el.innerHTML = css  if el

  socket.on 'refreshHtml', (templates) ->
    for name, template of templates
      view.make name, template
    view.history.refresh()

  socket.on 'refreshJs', ->
    window.location.reload true
