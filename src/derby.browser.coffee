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

  # "$$templates$$" is replaced with an array of templates by loader
  view.make name, template  for name, template of "$$templates$$"

  appModule.exports = (modelBundle, ctx) ->
    model.on 'initialized', ->
      view.render model, ctx, true
    racer.init modelBundle
    return appExports

  return appExports
