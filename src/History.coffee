win = window
winHistory = win.history
winLocation = win.location

History = module.exports = (@_routes, @_page) -> return

History:: =

  push: (url, render) ->
    winHistory.pushState null, null, url
    return unless render
    page = @_page
    for route in @_routes
      console.log url, route[0]
      route[1] page, page.model  if route[0] == url
    return

  replace: (url, render) ->
    winHistory.replaceState null, null, url

  back: winHistory.back

  forward: winHistory.forward

  go: winHistory.go

  _onClickLink: (e, href) ->
    e.preventDefault()
    @push href, true
