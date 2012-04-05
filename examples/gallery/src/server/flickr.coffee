request = require 'request'

FLICKR_API = 'http://api.flickr.com/services/rest/'

exports.setup = (store, options) ->
  flickr = new Flickr options

  # Prefacing the ids with 'id_' is needed, since photosets
  # start with a number, and paths must only start with a
  # letter or underscore, like JS variable names

  store.route 'get', 'flickr.user.id_*.photos.pages.*', (username, page, done) ->
    flickr.userPublicPhotos username, page, done

  store.route 'get', 'flickr.photoset.id_*.photos.pages.*', (id, page, done) ->
    flickr.setPhotos id, page, done


Flickr = (options) ->
  @key = options.key
  @userIds = {}
  return

Flickr:: =

  get: (qs, callback) ->
    qs.format = 'json'
    qs.api_key = @key
    qs.per_page = 20
    qs.extras = 'o_dims'
    request {url: FLICKR_API, qs}, (err, res, body) ->
      return callback err if err
      unless (match = /jsonFlickrApi\((.*)\)/.exec body) && (body = match[1])
       return callback new Erorr 'Unknown Flickr response'
      data = JSON.parse body
      unless data.stat == 'ok'
        return callback new Error data.message
      callback null, data

  userId: (username, callback) ->
    if id = @userIds[username]
      return callback null, id
    qs = {method: 'flickr.people.findByUsername', username}
    @get qs, (err, body) =>
      return callback err if err
      id = @userIds[username] = body.user.id
      callback null, id

  userPublicPhotos: (username, page, callback) ->
    @userId username, (err, user_id) =>
      return callback err if err
      qs = {method: 'flickr.people.getPublicPhotos', user_id, page: +page + 1}
      @get qs, (err, body) ->
        return callback err if err
        callback null, body.photos.photo, -1

  setPhotos: (photoset_id, page, callback) ->
    qs = {method: 'flickr.photosets.getPhotos', photoset_id, page: +page + 1}
    @get qs, (err, body) ->
      return callback err if err
      callback null, body.photoset.photo, -1
