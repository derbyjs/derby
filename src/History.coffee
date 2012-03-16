qs = require 'qs'
{render: renderRoute} = require './routes'

win = window
winHistory = win.history
winLocation = win.location
doc = win.document
currentPath = winLocation.pathname

if winHistory.replaceState
  # Replace the initial state with the current URL immediately,
  # so that it will be rendered if the state is later popped
  winHistory.replaceState {render: true, method: 'get'}, null, winLocation.href

History = module.exports = (page, routes, dom) ->
  @_page = page
  @_routes = routes
  {addListener} = dom

  if winHistory.pushState
    addListener doc, 'click', (e) =>
      # Detect clicks on links
      # Ignore command click, control click, and middle click
      if e.target.href && !e.metaKey && e.which == 1
        url = e.target.href
        # Ignore hash links to the same page
        return if ~(i = url.indexOf '#') && 
          url.substr(0, i) == winLocation.href.replace(/#.*/, '')
        @push url, true, e

    addListener doc, 'submit', (e) =>
      if e.target.tagName.toLowerCase() is 'form'
        form = e.target
        return if !(url = form.action) || form._forceSubmit ||
          form.enctype == 'multipart/form-data'
        @push url, true, e

    addListener win, 'popstate', (e) =>
      previous = currentPath
      currentPath = winLocation.pathname
      # Pop states without a state object were generated externally,
      # such as by a jump link, so they shouldn't be handled 
      return unless (state = e.state) && state.render
      # Note that the post body is only sent on the initial reqest
      # and null is sent if the state is later popped
      renderRoute page, routes, previous, winLocation.pathname, state.method, e

  else
    @push = @replace = ->

  return

# TODO: Add support for get & post form submissions

History:: =

  push: (url, render, e) -> @_update 'pushState', url, render, e

  replace: (url, render, e) -> @_update 'replaceState', url, render, e

  # Rerender the current url locally
  refresh: ->
    path = routePath winLocation.href
    renderRoute @_page, @_routes, path, path, 'get'

  back: -> winHistory.back()

  forward: -> winHistory.forward()

  go: (i) -> winHistory.go i

  _update: (historyMethod, url, render = true, e) ->
    return unless path = routePath url

    # If this is a form submission, extract the form data and
    # append it to the url for a get or params.body for a post
    if e && e.type is 'submit'
      form = e.target
      query = []
      for el in form.elements
        if name = el.name
          query.push encodeURIComponent(name) + '=' + encodeURIComponent(el.value)
          if name is '_method'
            override = el.value.toLowerCase()
            override = 'del' if override is 'delete'
      query = query.join '&'

      if form.method.toLowerCase() is 'post'
        method = override || 'post'
        body = qs.parse query
      else
        method = 'get'
        path += '?' + query
    else
      method = 'get'

    # Update the URL
    previous = winLocation.pathname
    winHistory[historyMethod] {render, method}, null, path
    currentPath = winLocation.pathname

    renderRoute @_page, @_routes, previous, path, method, e, body, form  if render

routePath = (url) ->
  # Get the pathname if it is on the same protocol and domain
  match = /^(https?:)\/\/([^\/]+)(.*)/.exec url
  return match && match[1] == winLocation.protocol &&
    match[2] == winLocation.host && match[3]
