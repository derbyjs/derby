{get, view, ready} = app = require('derby').createApp module

view.fn 'flickrPhoto', (obj, options = 's') ->
  if obj
    "http://farm#{obj.farm}.staticflickr.com/#{obj.server}/#{obj.id}_#{obj.secret}_#{options}.jpg"
  else ''

get '/flickr/:type/:id/:image?', (page, model, {type, id, image, query}) ->
  pageIndex = if query.page then query.page - 1 else 0
  model.fetch "flickr.#{type}.id_#{id}.photos.pages.#{pageIndex}", (err, photos) ->
    model.ref '_pages', photos.parent()
    model.ref '_page', '_pages', '_selectedPage'
    model.ref '_image', '_page', '_selectedImage'
    model.set '_selectedPage', pageIndex
    model.set '_selectedImage', image
    page.render title: 'Cr&egrave;me Br&ucirc;l&eacute;e'


ready (model) ->

  app.select = (e, el) ->
    model.set '_selectedImage', model.at(el).leaf()

  model.set '_showReconnect', true
  app.connect = ->
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()
  app.reload = -> window.location.reload()
