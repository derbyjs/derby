qs = require 'qs'

win = window
winHistory = win.history
winLocation = win.location
doc = win.document

if winHistory.replaceState
  # Replace the initial state with the current URL immediately,
  # so that it will be rendered if the state is later popped
  winHistory.replaceState {render: true, method: 'get'}, null, winLocation.href

History = module.exports = (@_routes, @_page, dom) ->
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
      # Pop states without a state object were generated externally,
      # such as by a jump link, so they shouldn't be handled 
      return unless (state = e.state) && state.render
      # Note that the post body is only sent on the initial reqest
      # and null is sent if the state is later popped
      renderRoute winLocation.pathname, @_page, @_routes[state.method], 0, null, null, e

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
    renderRoute path, @_page, @_routes['get'], 0

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

    winHistory[historyMethod] {render, method}, null, path
    renderRoute path, @_page, @_routes[method], 0, body, form, e  if render

cancelRender = (url, form, e) ->
  # Don't do anything if this is the result of an event, since the
  # appropriate action will happen by default
  return if e
  # Otherwise, manually perform appropriate action
  if form
    form._forceSubmit = true
    form.submit()
  else
    win.location = url  

renderRoute = (url, page, routes, i, body, form, e) ->
  url = url.replace /#.*/, ''
  [path, query] = url.split '?'
  while route = routes[i++]
    continue unless match = route.match path
    # Cancel the default action when a route is found to match
    e.preventDefault()  if e

    params = {url, body, query: if query then qs.parse query else {}}
    for {name}, j in route.keys
      params[name] = match[j + 1]
    next = (err) ->
      return cancelRender url, form  if err?
      renderRoute url, page, routes, i, body, form
    try
      route.callbacks page, page.model, params, next
    catch err
      cancelRender url, form
    return

  # Cancel rendering by this app if no routes match
  cancelRender url, form, e

routePath = (url) ->
  # Get the pathname if it is on the same protocol and domain
  match = /^(https?:)\/\/([^\/]+)(.*)/.exec url
  return match && match[1] == winLocation.protocol &&
    match[2] == winLocation.host && match[3]
