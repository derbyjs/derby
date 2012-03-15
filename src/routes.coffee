qs = require 'qs'
Route = require 'express/lib/router/route'

exports.addHttpMethods = (appExports) ->
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

  onMatch = (path, url, i, route, match, renderNext, noPage) ->
    # Cancel the default browser action, such as clicking a link or submitting a form
    e.preventDefault()  if e

    params = []
    params.url = url
    params.body = body
    params.query = query

    # Add params from capture groups
    keys = route.keys
    for i in [1...match.length]
      capture = match[i]
      key = keys[i - 1]
      value = if typeof capture is 'string' then decodeURIComponent capture else capture
      if key then params[key.name] = value else params.push value

    next = (err) ->
      return cancelRender url, form  if err?
      renderNext previous, path, url, form, null, onMatch, map, queue, i

    try
      if noPage
        route.callbacks page.model, params, next
      else
        route.callbacks page, page.model, params, next, reroute
    catch err
      cancelRender url, form
    return

  renderMapped previous, path, url, form, e, onMatch, map, queue, 0

renderMapped = (previous, path, url, form, e, onMatch, map, queue, i) ->
  while item = map[i++]
    continue unless match = item.to.match path
    continue unless item.from.match previous
    return onMatch path, url, i, item.to, match, renderMapped, true

  renderQueued previous, path, url, form, e, onMatch, map, queue, 0

renderQueued = (previous, path, url, form, e, onMatch, map, queue, i) ->
  while route = queue[i++]
    continue unless match = route.match path
    return onMatch path, url, i, route, match, renderQueued

  # Cancel rendering by this app if no routes match
  cancelRender url, form, e
