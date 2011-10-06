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
onlyWhitespace = /^[\s\n]*$/

findPath = (root, name, dir, extension, callback) ->
  root = join root, dir, name  if name
  path = root + extension
  exists path, (value) ->
    return callback path  if value
    path = join root, 'index' + extension
    exists path, (value) ->
      callback if value then path else null

loadTemplates = (root, fileName, get, templates, callback) ->
  callback.count = (callback.count || 0) + 1
  findPath root, fileName, 'views', '.html', (path) ->
    unless path
      # Return without doing anything if the path isn't found, and this is the
      # initial lookup based on the clientName. Otherwise, throw an error
      if fileName then return callback {}
      else throw new Error "Can't find #{root}/views/#{fileName}"

    fs.readFile path, 'utf8', (err, template) ->
      return callback err  if err
      name = ''
      from = ''
      importName = ''
      htmlParser.parse template,
        start: (tag, tagName, attrs) ->
          i = tagName.length - 1
          name = (if tagName[i] == ':' then tagName.substr 0, i else '').toLowerCase()
          from = attrs.from
          importName = attrs.import
          if name is 'all' && importName
            throw new Error "Can't specify import attribute with All in #{path}"
        chars: (text, literal) ->
          return unless get == 'all' || get == name
          if from
            unless onlyWhitespace.test text
              throw new Error "Template import '#{name}' in #{path} can't contain content"
            return loadTemplates join(dirname(path), from), null, name, templates, callback
          unless name && literal
            return if onlyWhitespace.test text
            throw new Error "Can't read template in #{path} near the text: #{text}"
          templates[name] = trim text

      callback templates unless --callback.count

module.exports =
  isProduction: isProduction = process.env.NODE_ENV is 'production'

  css: (root, clientName, callback) ->
    # CSS is reloaded on every refresh in development and cached in production
    return callback css  if isProduction && css = cssCache[clientName]
    findPath root, clientName, 'styles', '.styl', (path) ->
      return callback cssCache[path] = ''  unless path
      fs.readFile path, 'utf8', (err, styl) ->
        return callback cssCache[path] = ''  if err
        stylus(styl)
          .use(nib())
          .set('filename', path)
          .set('compress', true)
          .render (err, css) ->
            throw err if err
            css = trim css
            callback cssCache[path] = css

  views: views = (view, root, clientName, callback) ->
    loadTemplates root, clientName, 'all', {}, (templates) ->
      for name, text of templates
        view.make name, text
        view._templates[name] = text
      callback()

  js: (view, parentFilename, options, callback) ->
    return callback {}  unless parentFilename
    root = parentDir = dirname parentFilename
    if (base = basename parentFilename, '.js') is 'index'
      base = basename parentDir
      root = dirname dirname parentDir
    else if basename(parentDir) is 'lib'
      root = dirname parentDir

    clientName = options.name || base
    staticRoot = options.staticRoot || join root, 'public'
    staticDir = options.staticDir || 'gen'
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
        -> fs.readFile join(parentDir, 'inline.js'), 'utf8', (err, inline) ->
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
