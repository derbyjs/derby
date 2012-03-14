Router = require 'express/lib/router'
routes = module.exports = require './routes'

routes.addHttpMethods = (appExports, view, createModel) ->
  routes = []
  ['get', 'post', 'put', 'del'].forEach (method) ->
    appExports[method] = (pattern, callback) ->
      routes.push [method, pattern, callback]
      return appExports

  parseReq = (req, res) ->
    model = req.model || req.model = createModel()
    page = req.derbyPage || req.derbyPage = new Page view, res, model
    {url, body, query} = req
    params = {url, body, query}
    params[k] = v for k, v of req.params
    return [page, model, params]

  appExports.router = ->
    router = new Router serverMock
    middleware = router.middleware
    routes.forEach ([method, pattern, callback]) ->
      if typeof pattern is 'object'
        {from, to} = pattern
        callback = pattern.forward || callback.forward || callback
        router._route method, to, (req, res, next) ->
          [page, model, params] = parseReq req, res, true
          render = page.render
          page.render = (ns, ctx, status) ->
            callback model, params, next
            page.render = render
            page.render ns, ctx, status
          req.url = from
          middleware req, res, next
        return

      router._route method, pattern, (req, res, next) ->
        [page, model, params] = parseReq req, res
        callback page, model, params, next
    return middleware

  return routes

Page = routes.Page = (@view, @res, @model) -> return
Page:: =
  render: (ns, ctx, status) ->
    @view.render @res, @model, ns, ctx, status
  redirect: (url, status) ->
    @res.redirect url, status

# The router middleware checks whether 'case sensitive routes' and 'strict routing'
# are enabled. For now, always use the default value of false
serverMock =
  enabled: -> false
