{get, view, ready} = require('derby').createApp module

get '/:username', (page, model, {username}) ->
  user = model.at 'flickr.users.' + username
  model.ref '_user', user
  model.fetch user.at('publicPhotos'), ->
    page.render JSON.stringify model.get '_user.publicPhotos'
