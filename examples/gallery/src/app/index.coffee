{get, view, ready} = require('derby').createApp module

view.fn 'flickrPhoto', (obj, options = 's') ->
  "http://farm#{obj.farm}.staticflickr.com/#{obj.server}/#{obj.id}_#{obj.secret}_#{options}.jpg"

get '/flickr/:type/:id/:num?', (page, model, {type, id, num}) ->
  num = if num then num - 1 else 0
  model.fetch "flickr.#{type}.#{id}.photos.pages.#{num}", (err, photos) ->
    model.ref '_pages', photos.parent()
    page.render()
