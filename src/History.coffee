win = window
winHistory = win.history

History = module.exports = (@_routes, page) ->
  page.history = this
  @_page = page
  return

# TODO: Deal with full URLs and relative URLs
# TODO: Pop state handling

History:: =

  push: (url, render, e) ->
    @_update 'pushState', url, render, e

  replace: (url, render, e) ->
    @_update 'replaceState', url, render, e

  _update: (method, url, render, e) -> 
    winHistory[method] {render}, null, url
    renderRoute url, @_page, @_routes, 0, e  if render

  _onClickLink: (e, href) ->
    @push href, true, e

  back: winHistory.back

  forward: winHistory.forward

  go: winHistory.go

renderRoute = (url, page, routes, i, e) ->
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
