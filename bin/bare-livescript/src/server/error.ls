path  = require 'path'
derby = require 'derby'

module.exports = ->
  staticPages = derby.createStatic path.dirname(path.dirname __dirname)

  (err, req, res, next) ->
    return next! unless err?

    console.log if err.stack then err.stack else err

    # Customize error handling here
    message = err.message or err.toString!
    status = parseInt message
    status = if 400 <= status < 600 then status else 500

    if status is 403 or status is 404 or status is 500
      staticPages.render 'error', res, status.toString!, status
    else
      res.send status
