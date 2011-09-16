{dirname, basename, join, exists} = require 'path'
fs = require 'fs'
crypto = require 'crypto'
stylus = require 'stylus'
nib = require 'nib'
racer = require 'racer'

isProduction = process.env.NODE_ENV is 'production'
cssCache = {}

module.exports =

  css: (root, clientName, callback) ->
    path = join root, 'styles', clientName, 'index.styl'
    callback css  if isProduction && css = cssCache[path]
    fs.readFile path, 'utf8', (err, styl) ->
      stylus(styl)
        .use(nib())
        .set('filename', path)
        .set('warn', true)
        .set('compress', true)
        .render (err, css) ->
          throw err if err
          callback css
          cssCache[path] = css
  
  views: (view, root, clientName) ->
    dir = join root, 'views', clientName
    fs.readdir dir, (err, files) ->
      return unless files
      for file in files
        do (file) -> fs.readFile join(dir, file), 'utf8', (err, template) ->
          [viewName, scope] = file.split '.'
          view.make viewName, template

  js: (parentFilename, options, callback) ->
    if (base = basename parentFilename, '.js') is 'index'
      base = basename dirname parentFilename
      root = dirname dirname dirname parentFilename
    else
      root = dirname parentFilename
    
    clientName = options.name || base
    staticRoot = options.root || join root, 'public'
    staticDir = options.dir || 'gen'
    staticPath = join staticRoot, staticDir

    minify = if 'minify' of options then options.minify else isProduction
    bundle = -> racer.js {minify, require: parentFilename}, (js) ->
      filename = crypto.createHash('md5').update(js).digest('base64') + '.js'
      # Base64 uses characters reserved in URLs and adds extra padding charcters.
      # Replace "/" and "+" with the unreserved "-" and "_" and remove "=" padding
      filename = filename.replace /[\/\+=]/g, (match) ->
        switch match
          when '/' then '-'
          when '+' then '_'
          when '=' then ''
      jsFile = join '/', staticDir, filename
      filePath = join staticPath, filename
      fs.writeFile filePath, js
      
      callback {root, clientName, jsFile, require: basename parentFilename}

    exists staticPath, (value) ->
      return bundle() if value
    
      exists staticRoot, (value) ->
        if value then return fs.mkdir staticPath, 0777, (err) ->
          bundle()
        fs.mkdir staticRoot, 0777, (err) ->
          fs.mkdir staticPath, 0777, (err) ->
            bundle()
