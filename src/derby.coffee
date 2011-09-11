racer = require 'racer'
View = require './View.server'
path = require 'path'
fs = require 'fs'
crypto = require 'crypto'

module.exports =

  options: {}

  configure: (@options) ->

  createApp: (appModule, appExports) ->
    # Expose Racer and Derby methods on the application module
    racer.util.merge appExports, racer
    appExports.view = view = new View

    appExports.ready = ->

    view._clientName = @options.name || path.basename appModule.filename, '.js'
    staticRoot = @options.root || path.dirname(appModule.filename) + '/public'
    staticDir = @options.dir || 'gen'
    staticPath = path.join staticRoot, staticDir

    minify = process.env.NODE_ENV is 'production'
    bundle = -> racer.js {minify, require: appModule.filename}, (js) ->
      filename = crypto.createHash('md5').update(js).digest('base64') + '.js'
      # Base64 uses characters reserved in URLs and adds extra padding charcters.
      # Replace "/" and "+" with the unreserved "-" and "_" and remove "=" padding
      filename = filename.replace /[\/\+=]/g, (match) ->
        switch match
          when '/' then '-'
          when '+' then '_'
          when '=' then ''
      view._jsFile = "/#{staticDir}/#{filename}"
      filePath = path.join staticPath, filename
      fs.writeFile filePath, js

    path.exists staticPath, (exists) ->
      return bundle() if exists
    
      path.exists staticRoot, (exists) ->
        if exists then return fs.mkdir staticPath, 0777, (err) ->
          bundle()
        fs.mkdir staticRoot, 0777, (err) ->
          fs.mkdir staticPath, 0777, (err) ->
            bundle()

    return appExports

