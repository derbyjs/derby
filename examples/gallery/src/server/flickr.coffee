request = require 'request'

FLICKR_API = 'http://api.flickr.com/services/rest/'

exports.setup = (store, options) ->
  flickr = new Flickr options

  store.route 'get', 'flickr.users.*.publicPhotos', (username, done) ->
    flickr.publicPhotos username, done


Flickr = (options) ->
  @key = options.key
  @userIds = {}
  return

Flickr:: =

  get: (qs, callback) ->
    qs.format = 'json'
    qs.api_key = @key
    request {url: FLICKR_API, qs}, (err, res, body) ->
      return callback err if err
      unless (match = /jsonFlickrApi\((.*)\)/.exec body) && (body = match[1])
       return callback new Erorr 'Unknown Flickr response'
      data = JSON.parse body
      callback null, data

  userId: (username, callback) ->
    if id = @userIds[username]
      return callback null, id
    qs = {method: 'flickr.people.findByUsername', username}
    @get qs, (err, body) =>
      return callback err if err
      id = @userIds[username] = body.user.id
      callback null, id

  publicPhotos: (username, callback) ->
    @userId username, (err, user_id) =>
      return callback err if err
      qs = {method: 'flickr.people.getPublicPhotos', user_id}
      @get qs, (err, body) ->
        return callback err if err
        callback null, body.photos
