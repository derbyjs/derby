parseUrl = require('url').parse
{get, view, ready} = app = require('derby').createApp module

fillDimension = (max, side, otherSide) ->
  return if side >= otherSide
    max
  else
    side * max / otherSide

photoDimension = (obj, source, size = 's', type) ->
  if source is 'flickr'
    if type is 'width'
      side = obj.o_width
      otherSide = obj.o_height
    else
      side = obj.o_height
      otherSide = obj.o_width
    if size is 's'
      return 75
    if size is 'm'
      return fillDimension 240, side, otherSide
  return

photoDimensionFn = (type) ->
  return (obj, source, size, scale = 1) ->
    return unless obj
    return Math.round photoDimension(obj, source, size, type) * scale

photoSrc = (obj, source, size = 's') ->
  return unless obj
  if source is 'flickr'
    return "http://farm#{obj.farm}.staticflickr.com/" +
      "#{obj.server}/#{obj.id}_#{obj.secret}_#{size}.jpg"
  return

view.fn 'photoWidth', photoDimensionFn 'width'
view.fn 'photoHeight', photoDimensionFn 'height'
view.fn 'photoSrc', photoSrc

preCache = (obj, source, callback) ->
  src = photoSrc obj, source, 'm'
  img = document.createElement 'img'
  img.style.display = 'none'
  img.src = src
  cancelled = false
  callback.cancel = -> cancelled = true
  finish = ->
    document.body.removeChild img
    callback() unless cancelled
  count = 2
  wait = -> --count || finish()
  img.onload = wait
  setTimeout wait, 50
  document.body.appendChild img

get '/:source/:type/:id/:image?', (page, model, params, next) ->
  {source, type, id, image, query} = params
  {search} = parseUrl params.url
  next() unless source is 'flickr'
  pageIndex = if query.page then query.page - 1 else 0
  model.fetch "#{source}.#{type}.id_#{id}.photos.pages.#{pageIndex}", (err, photos) ->
    model.ref '_pages', photos.parent()
    model.ref '_page', '_pages', '_selectedPage'

    model.set '_toggle', 0
    model.set '_fade0', 1
    model.set '_fade1', 0

    model.ref '_image0', '_page', '_selected0'
    model.ref '_image1', '_page', '_selected1'

    model.set '_selectedPage', pageIndex
    model.set '_selected0', image
    page.render {source, search}

lastLoad = null
get from: '/:source/:type/:id/:image?', to: '/:source/:type/:id/:image?',
  (model, params, next) ->
    {source, type, id, image, query} = params
    next() unless source is 'flickr'
    pageIndex = if query.page then query.page - 1 else 0
    model.set '_selectedPage', pageIndex

    lastLoad.cancel() if lastLoad
    lastLoad = ->
      lastLoad = null
      toggleValue = +!model.get('_toggle')
      model.set '_toggle', toggleValue
      model.set '_selected' + toggleValue, image
      model.set '_fade' + toggleValue, 1
    preCache model.get('_page.' + image), source, lastLoad

ready (model) ->

  app.select = (e, el) ->
    model.set '_fade' + model.get('_toggle'), 0
    url = model.at(el).leaf() + window.location.search
    view.history.push url

  model.set '_showReconnect', true
  app.connect = ->
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()
  app.reload = -> window.location.reload()
