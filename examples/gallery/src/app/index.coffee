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
  return unless obj
  photoDimension obj, source, size, 'width'

view.fn 'photoHeight', (obj, source, size) ->
  return unless obj
  photoDimension obj, source, size, 'height'

view.fn 'photoSrc', (obj, source, size = 's') ->
  return unless obj
  if source is 'flickr'
    return "http://farm#{obj.farm}.staticflickr.com/" +
      "#{obj.server}/#{obj.id}_#{obj.secret}_#{size}.jpg"
  return

get '/:source/:type/:id/:image?', (page, model, params, next) ->
  {source, type, id, image, query} = params
  next() unless source is 'flickr'
  pageIndex = if query.page then query.page - 1 else 0
  model.fetch "#{source}.#{type}.id_#{id}.photos.pages.#{pageIndex}", (err, photos) ->
    model.ref '_pages', photos.parent()
    model.ref '_page', '_pages', '_selectedPage'

    model.setNull '_toggle', 0
    model.fn '_toggleInverse', '_toggle', (value) -> +!value

    model.ref '_selectedImage', '_selected', '_toggle'
    model.ref '_previousImage', '_selected', '_toggleInverse'
    model.ref '_image', '_page', '_selectedImage'
    model.ref '_imagePrevious', '_page', '_previousImage'

    model.set '_selectedPage', pageIndex
    model.set '_selected.' + model.get('_toggle'), image
    console.log model.get('_selectedImage'), model.get('_image')
    page.render {source}

get from: '/:source/:type/:id/:image?', to: '/:source/:type/:id/:image?',
  (model, params, next) ->
    {source, type, id, image, query} = params
    next() unless source is 'flickr'
    pageIndex = if query.page then query.page - 1 else 0
    model.set '_selectedPage', pageIndex
    model.set '_selected.' + model.get('_toggle'), image

ready (model) ->

  app.select = (e, el) ->
    # model.set '_image._opacity', 0
    model.set '_toggle', model.get('_toggleInverse')
    # model.set '_image._opacity', 1
    url = model.at(el).leaf() + window.location.search
    view.history.push url

  model.set '_showReconnect', true
  app.connect = ->
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()
  app.reload = -> window.location.reload()
