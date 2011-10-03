win = window
winHistory = win.history
winLocation = win.location

History = module.exports = (@_routes, page) ->
  page.history = this
  @_page = page
  return

History:: =

  push: (url, render, e) ->
    @_update 'pushState', url, render, e

  replace: (url, render, e) ->
    @_update 'replaceState', url, render, e

  _update: (method, url, render, e) -> 
    winHistory[method] {render}, url, url
    renderRoute url, @_page, @_routes, 0, e  if render

  _onClickLink: (e) ->
    # Try rendering the page locally if it is a different URL
    # on the same domain
    match = /^https?:\/\/([^\/]+)([^#]+)/.exec e.target.href
    return unless match && match[1] == winLocation.host &&
      (path = match[2]) != winLocation.pathname
    @push path, true, e

  _onPop: (e) ->
    e.preventDefault()
    unless e.state && !e.state.render
      renderRoute winLocation.pathname, @_page, @_routes, 0

  back: winHistory.back

  forward: winHistory.forward

  go: winHistory.go

renderRoute = (url, page, routes, i, e) ->
  console.log 'render', url
  while route = routes[i++]
    continue unless match = route.match url
    # Cancel the default link action
    e.preventDefault()  if e

    params = url: match[0]
    for {name}, j in route.keys
      params[name] = match[j + 1]
    next = -> renderRoute url, page, routes, i
    route.callbacks page, page.model, params, next
    return

  # Update the location if the route can't be handled
  # and it has been cancelled or is not from a link
  win.location = url  unless e
