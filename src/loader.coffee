{dirname, basename, join, exists} = require 'path'
fs = require 'fs'
crypto = require 'crypto'
stylus = require 'stylus'
nib = require 'nib'
racer = require 'racer'
{trim} = require './View'
htmlParser = require './htmlParser'

cssCache = {}
jsCache = {}

findPath = (root, clientName, dir, extension, callback) ->
  path = join root, dir, clientName + extension
  exists path, (value) ->
    return callback path  if value
    path = join root, dir, clientName, 'index' + extension
    exists path, (value) ->
      callback if value then path else null

module.exports =
  isProduction: isProduction = process.env.NODE_ENV is 'production'
  
  css: (root, clientName, callback) ->
    return callback ''  unless clientName
    # CSS is reloaded on every refresh in development and cached in production
    return callback css  if isProduction && css = cssCache[clientName]
    findPath root, clientName, 'styles', '.styl', (path) ->
      fs.readFile path, 'utf8', (err, styl) ->
        return callback cssCache[path] = ''  if err
        stylus(styl)
          .use(nib())
          .set('filename', path)
          .set('compress', true)
          .render (err, css) ->
            throw err if err
            css = trim css
            callback css
            cssCache[path] = css

  views: views = (view, root, clientName, callback) ->
    findPath root, clientName, 'views', '.html', (path) ->
      return callback new Error "Can't find #{root}/views/#{clientName}"  unless path
      fs.readFile path, 'utf8', (err, template) ->
        return callback err  if err
        viewName = ''
        htmlParser.parse template,
          start: (tag, name, attrs) ->
            i = name.length - 1
            viewName = if name[i] == ':' then name.substr 0, i else ''
          chars: (text, literal) ->
            unless viewName && literal
              return if /^[\s\n]*$/.test text
              throw "Misformed template in #{path}: #{text}"
            text = trim text
            view.make viewName, text
            view._templates[viewName] = text
        callback()

  js: (view, parentFilename, options, callback) ->
    return callback {}  unless parentFilename
    if (base = basename parentFilename, '.js') is 'index'
      base = basename dirname parentFilename
      dir = dirname parentFilename
      root = dirname dirname dir
    else
      root = dirname parentFilename

    clientName = options.name || base
    staticRoot = options.root || join root, 'public'
    staticDir = options.dir || 'gen'
    staticPath = join staticRoot, staticDir

    finish = (js) -> views view, root, clientName, ->
      js = js.replace '"$$templates$$"', JSON.stringify(view._templates || {})
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
      fs.writeFile filePath, js, ->
        callback {root, clientName, jsFile, require: basename parentFilename}

    # Browserifying is very slow, so js files are only bundled up on the first
    # page load, even in development. Templates are reloaded every refresh in
    # development and cached in production
    minify = if 'minify' of options then options.minify else isProduction
    bundle = if isProduction || !(js = jsCache[parentFilename])
        -> fs.readFile join(dir, 'inline.js'), 'utf8', (err, inline) ->
          racer.js {minify, require: parentFilename}, (js) ->
            finish jsCache[parentFilename] = js
          return  if err
          view.inline "function(){#{inline}}"
      else
        -> finish js

    exists staticPath, (value) ->
      return bundle() if value

      exists staticRoot, (value) ->
        if value then return fs.mkdir staticPath, 0777, (err) ->
          bundle()
        fs.mkdir staticRoot, 0777, (err) ->
          fs.mkdir staticPath, 0777, (err) ->
            bundle()
