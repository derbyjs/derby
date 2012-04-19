qs = require 'qs'
Route = require 'express/lib/router/route'
{mergeAll} = require('racer').util
util = require './util'

passThroughNoPage = (model, params, next) -> next()

exports.addHttpMethods = (appExports) ->
  routes = queue: {}, map: {}
  ['get', 'post', 'put', 'del'].forEach (method) ->
    queue = routes.queue[method] = []
    map = routes.map[method] = []

    appExports[method] = (pattern, callback, callback2) ->
      if typeof pattern is 'object'
        {from, to} = pattern
        forward = pattern.forward || callback.forward || callback
        back = pattern.back || callback.back || callback2 || passThroughNoPage
        fromRoute = new Route method, from, back
        toRoute = new Route method, to, forward
        map.push {from: fromRoute, to: toRoute}, {from: toRoute, to: fromRoute}
        queue.push new Route method, to, (page, model, params, next, reroute) ->
          render = page.render
          page.render = (ns, ctx) ->
            forward model, params, next
            page.render = render
            page.render ns, ctx
          reroute mapRoute from, params
        return

      queue.push new Route method, pattern, callback
      return appExports

  return routes

Page = exports.Page = (@view, @model) -> return
Page:: =
  render: (ns, ctx) ->
    @view.render @model, ns, ctx
  redirect: (url) ->
    return @view.history.back()  if url is 'back'
    # TODO: Add support for `basepath` option like Express
    url = '\\'  if url is 'home'
    @view.history.replace url, true

exports.mapRoute = mapRoute = (from, params) ->
  {url} = params
  queryString = if ~(i = url.indexOf '?') then url[i..] else ''
  i = 0
  path = from.replace ///
    (?:
      (?:\:([^?/:*]+))
      |\*
    )\??
  ///g, (_, key) ->
    return params[key] if key
    return params[i++]
  return path + queryString

cancelRender = (url, form, e) ->
  # Don't do anything if this is the result of an event, since the
  # appropriate action will happen by default
  return if e
  # Otherwise, manually perform appropriate action
  if form
    form._forceSubmit = true
    form.submit()
  else
    window.location = url  

exports.render = (page, routes, previous, url, method, e, body, form) ->
  url = url.replace /#.*/, ''
  [path, queryString] = url.split '?'
  body ||= {}
  query = if queryString then qs.parse queryString else {}
  map = routes.map[method]
  queue = routes.queue[method]

  reroute = (url) ->
    path = if ~(i = url.indexOf '?') then url[0...i] else url
    renderQueued previous, path, url, form, null, onMatch, map, queue, 0

  onMatch = (path, url, i, route, renderNext, noPage) ->
    # Cancel the default browser action, such as clicking a link or submitting a form
    e.preventDefault()  if e

    routeParams = route.params
    params = routeParams.slice()
    mergeAll params, routeParams, {url, body, query}

    next = (err) ->
      return cancelRender url, form  if err?
      renderNext previous, path, url, form, null, onMatch, map, queue, i

    run = if noPage
      -> route.callbacks page.model, params, next
    else
      -> route.callbacks page, page.model, params, next, reroute

    return run() if util.DEBUG
    try
      run()
    catch err
      cancelRender url, form
    return

  renderMapped previous, path, url, form, e, onMatch, map, queue, 0

renderMapped = (previous, path, url, form, e, onMatch, map, queue, i) ->
  while item = map[i++]
    continue unless item.to.match path
    continue unless item.from.match previous
    return onMatch path, url, i, item.to, renderMapped, true

  renderQueued previous, path, url, form, e, onMatch, map, queue, 0

renderQueued = (previous, path, url, form, e, onMatch, map, queue, i) ->
  while route = queue[i++]
    continue unless route.match path
    return onMatch path, url, i, route, renderQueued

  # Cancel rendering by this app if no routes match
  cancelRender url, form, e
