Route = require 'express/lib/router/route'
racer = require 'racer'
derbyModel = require './derby.Model'
Dom = require './Dom'
View = require './View'
History = require './History'

Page = (@view, @model) -> return
Page:: =
  render: (ns, ctx) ->
    @view.render @model, ns, ctx
  redirect: (url) ->
    return @view.history.back()  if url is 'back'
    # TODO: Add support for `basepath` option like Express
    url = '\\'  if url is 'home'
    @view.history.replace url, true

exports.createApp = (appModule) ->
  appExports = appModule.exports
  # Expose methods on the application module
  appExports.view = view = new View

  routes = queue: {}, map: {}
  ['get', 'post', 'put', 'del'].forEach (method) ->
    queue = routes.queue[method] = []
    map = routes.map[method] = []

    appExports[method] = (pattern, callback, callback2) ->
      if typeof pattern is 'object'
        {from, to} = pattern
        forward = pattern.forward || callback.forward || callback
        back = pattern.back || callback.back || callback2
        fromRoute = new Route method, from, back
        toRoute = new Route method, to, forward
        map.push {from: fromRoute, to: toRoute}, {from: toRoute, to: fromRoute}
        queue.push new Route method, to, (page, model, params, next, reroute) ->
          render = page.render
          page.render = (ns, ctx) ->
            forward model, params, next
            page.render = render
            page.render ns, ctx
          reroute from
        return

      queue.push new Route method, pattern, callback
      return appExports

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
      history = view.history = new History routes, page, dom
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
