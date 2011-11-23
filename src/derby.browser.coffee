racer = require 'racer'
modelHelper = require './modelHelper'
Dom = require './Dom'
View = require './View'
History = require './History'
Route = require 'express/lib/router/route'

Page = -> return
Page:: =
  render: (ctx) ->
    @view.render @model, ctx
  redirect: (url) ->
    return @history.back()  if url is 'back'
    # TODO: Add support for `basepath` option like Express
    url = '\\'  if url is 'home'
    @history.replace url, true

exports.createApp = (appModule) ->
  appExports = appModule.exports
  # Expose methods on the application module
  appExports.view = view = new View

  routes = {}
  ['get', 'post', 'put', 'del'].forEach (method) ->
    queue = routes[method] = []
    appExports[method] = (pattern, callback) ->
      queue.push new Route method, pattern, callback
  history = new History routes, page = new Page

  model = view.model = racer.model
  dom = view.dom = new Dom model, appExports, history
  modelHelper.init model, dom, view
  appExports.ready = (fn) -> racer.onready = -> fn model
  page.view = view
  page.model = model

  # "$$templates$$" is replaced with an array of templates by loader
  view.make name, template  for name, template of "$$templates$$"

  appModule.exports = (modelBundle, ctx) ->
    racer.init modelBundle
    view.render model, ctx, true
    dom.init()
    return appExports

  return appExports
