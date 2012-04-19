Router = require 'express/lib/router'
{mapRoute} = router = module.exports = require './router'

router.addHttpMethods = (appExports, view, createModel) ->
  routes = []
  ['get', 'post', 'put', 'del'].forEach (method) ->
    appExports[method] = (pattern, callback) ->
      routes.push [method, pattern, callback]
      return appExports

  pageParams = (req) ->
    params = {url: req.url, body: req.body, query: req.query}
    params[k] = v for k, v of req.params
    return params

  appExports.router = ->
    expressRouter = new Router serverMock

    middleware = (req, res, next) ->
      unless previousModel = req.model
        req.model = createModel()
      expressRouter._dispatch req, res, (err) ->
        # Cleanup then continue
        req.model = previousModel
        next err

    routes.forEach ([method, pattern, callback]) ->
      # Create route for 'to' callback of transitional route
      if typeof pattern is 'object'
        {from, to} = pattern
        callback = pattern.forward || callback.forward || callback
        expressRouter.route method, to, (req, res, next) ->
          model = req.model
          page = new Page view, res, model
          params = pageParams req

          # Wrap the render function to run the forward callback
          # immediately before rendering
          render = page.render
          page.render = (ns, ctx, status) ->
            callback model, params, next
            page.render = render
            page.render ns, ctx, status

          # Reroute with the new URL and page
          req.url = mapRoute from, params
          previousPage = req._derbyPage
          req._derbyPage = page
          middleware req, res, next
          # Cleanup
          if previousPage
            req._derbyPage = page
          else
            delete req._derbyPage
        return

      # Create a normal route
      expressRouter.route method, pattern, (req, res, next) ->
        model = req.model
        page = req._derbyPage || new Page view, res, model
        params = pageParams req
        callback page, model, params, next
    return middleware

  return routes

Page = router.Page = (@view, @res, @model) -> return
Page:: =
  render: (ns, ctx, status) ->
    @view.render @res, @model, ns, ctx, status
  redirect: (url, status) ->
    # TODO: Appears there is a bug that Express throws when an undefined
    # status is passed. Fix bug and remove this condition
    if status
      @res.redirect url, status
    else
      @res.redirect url
    return

# The router middleware checks whether 'case sensitive routes' and 'strict routing'
# are enabled. For now, always use the default value of false
serverMock =
  enabled: -> false
