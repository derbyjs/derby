qs = require 'qs'
{parse: parseUrl, resolve: resolveUrl} = require 'url'
{render: renderRoute} = require './router'

win = window
winHistory = win.history
winLocation = win.location
doc = win.document
currentPath = winLocation.pathname

if winHistory.replaceState
  # Replace the initial state with the current URL immediately,
  # so that it will be rendered if the state is later popped
  winHistory.replaceState {$render: true, $method: 'get'}, null, winLocation.href

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
          url[0...i] == winLocation.href.replace(/#.*/, '')
        @push url, true, null, e
      return

    addListener doc, 'submit', (e) =>
      if e.target.tagName.toLowerCase() is 'form'
        form = e.target
        return if !(url = form.action) || form._forceSubmit ||
          form.enctype == 'multipart/form-data'
        @push url, true, null, e
      return

    addListener win, 'popstate', (e) ->
      previous = currentPath
      currentPath = winLocation.pathname
      if state = e.state
        return unless state.$render
        # Note that the post body is only sent on the initial reqest
        # and null is sent if the state is later popped
        return renderRoute page, routes, previous, currentPath, state.$method

      # The state object will be null for states created by jump links.
      # window.location.hash cannot be used, because it returns nothing
      # if the url ends in just a hash character
      url = winLocation.href
      if ~(i = url.indexOf '#') && currentPath != previous
        renderRoute page, routes, previous, currentPath, 'get'
        id = url.slice i + 1
        if el = doc.getElementById(id) || doc.getElementsByName(id)[0]
          el.scrollIntoView()
      return

  else
    @push = @replace = ->

  return

# TODO: Add support for get & post form submissions

History:: =

  push: (url, render, state, e) ->
    @_update 'pushState', url, render, state, e

  replace: (url, render, state, e) ->
    @_update 'replaceState', url, render, state, e

  # Rerender the current url locally
  refresh: ->
    path = routePath winLocation.href
    renderRoute @_page, @_routes, null, path, 'get'

  back: -> winHistory.back()

  forward: -> winHistory.forward()

  go: (i) -> winHistory.go i

  _update: (historyMethod, relativeUrl, render = true, state = {}, e) ->
    url = resolveUrl winLocation.href, relativeUrl
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
    state.$render = render
    state.$method = method
    winHistory[historyMethod] state, null, url
    currentPath = winLocation.pathname

    renderRoute @_page, @_routes, previous, path, method, e, body, form  if render

routePath = (url) ->
  # Get the pathname if it is on the same protocol and domain
  return (match = parseUrl url) &&
    match.protocol == winLocation.protocol &&
    match.host == winLocation.host &&
    match.pathname + (match.search || '')
