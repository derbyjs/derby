{get, view, ready} = app = require('derby').createApp module

fillDimension = (max, side, otherSide) ->
  return if side >= otherSide
    max
  else
    Math.round(side * max / otherSide)

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

view.fn 'photoWidth', (obj, source, size) ->
  photoDimension obj, source, size, 'width'

view.fn 'photoHeight', (obj, source, size) ->
  photoDimension obj, source, size, 'height'

view.fn 'photoSrc', (obj, source, size = 's') ->
  if source is 'flickr'
    if obj then return "http://farm#{obj.farm}.staticflickr.com/" +
      "#{obj.server}/#{obj.id}_#{obj.secret}_#{size}.jpg"
  return ''


get '/:source/:type/:id/:image?', (page, model, params, next) ->
  {source, type, id, image, query} = params
  next() unless source is 'flickr'
  pageIndex = if query.page then query.page - 1 else 0
  model.fetch "#{source}.#{type}.id_#{id}.photos.pages.#{pageIndex}", (err, photos) ->
    model.ref '_pages', photos.parent()
    model.ref '_page', '_pages', '_selectedPage'
    model.ref '_image', '_page', '_selectedImage'
    model.set '_selectedPage', pageIndex
    model.set '_selectedImage', image
    page.render {source}


ready (model) ->

  app.select = (e, el) ->
    image = model.at(el).leaf()
    model.set '_selectedImage', image
    view.history.push image, false

  model.set '_showReconnect', true
  app.connect = ->
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()
  app.reload = -> window.location.reload()
