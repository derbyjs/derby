{dirname, basename, join, exists} = require 'path'
fs = require 'fs'
crypto = require 'crypto'
stylus = require 'stylus'
nib = require 'nib'
racer = require 'racer'
{parse: parseHtml} = require './html'

onlyWhitespace = /^[\s\n]*$/

findPath = (root, name, dir, extension, callback) ->
  root = join root, dir, name  if name
  path = root + extension
  exists path, (value) ->
    return callback path  if value
    path = join root, 'index' + extension
    exists path, (value) ->
      callback if value then path else null

loadTemplates = (root, fileName, get, alias, templates, callback) ->
  callback.count = (callback.count || 0) + 1
  findPath root, fileName, 'views', '.html', (path) ->
    unless path
      # Return without doing anything if the path isn't found, and this is the
      # initial lookup based on the clientName. Otherwise, throw an error
      if fileName then return callback {}
      else throw new Error "Can't find #{root}/views/#{fileName}"

    got = false
    fs.readFile path, 'utf8', (err, template) ->
      return callback err  if err
      name = ''
      from = ''
      importName = ''
      parseHtml template,
        start: (tag, tagName, attrs) ->
          i = tagName.length - 1
          name = (if tagName[i] == ':' then tagName.substr 0, i else '').toLowerCase()
          from = attrs.from
          importName = attrs.import && attrs.import.toLowerCase()
          if name is 'all' && importName
            throw new Error "Can't specify import attribute with All in #{path}"
        chars: (text, literal) ->
          return unless get == 'all' || get == name
          got = true
          if from
            unless onlyWhitespace.test text
              throw new Error "Template import '#{name}' in #{path} can't contain content"
            if importName
              _alias = name
              name = importName
            return loadTemplates join(dirname(path), from), null, name, _alias, templates, callback
          unless name && literal
            return if onlyWhitespace.test text
            throw new Error "Can't read template in #{path} near the text: #{text}"
          templates[alias || name] = text

      throw new Error "Can't find template '#{get}' in #{path}"  unless got
      callback templates unless --callback.count


module.exports =

  css: (root, clientName, callback) ->
    findPath root, clientName, 'styles', '.styl', (path) ->
      return callback ''  unless path
      fs.readFile path, 'utf8', (err, styl) ->
        return callback ''  if err
        stylus(styl)
          .use(nib())
          .set('filename', path)
          .set('compress', true)
          .render (err, css) ->
            throw err if err
            callback css

  templates: (root, clientName, callback) ->
    loadTemplates root, clientName, 'all', null, {}, callback

  js: (parentFilename, callback) ->
    return callback {}  unless parentFilename
    inlineFile = join dirname(parentFilename), 'inline.js'

    js = inline = null
    count = 2
    finish = ->
      return if --count
      callback js, inline
    racer.js {require: parentFilename}, (value) ->
      js = value
      finish()
    fs.readFile inlineFile, 'utf8', (err, value) ->
      inline = value
      finish()

  parseName: (parentFilename, options) ->
    return {}  unless parentFilename
    root = parentDir = dirname parentFilename
    if (base = basename parentFilename, '.js') is 'index'
      base = basename parentDir
      root = dirname dirname parentDir
    else if basename(parentDir) is 'lib'
      root = dirname parentDir

    return {
      root: root
      clientName: options.name || base
      require: basename parentFilename
    }

  writeJs: (js, options, callback) ->
    staticRoot = options.staticRoot || join root, 'public'
    staticDir = options.staticDir || 'gen'
    staticPath = join staticRoot, staticDir

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
    finish = -> fs.writeFile filePath, js, -> callback jsFile

    exists staticPath, (value) ->
      return finish() if value

      exists staticRoot, (value) ->
        if value then return fs.mkdir staticPath, 0777, (err) ->
          bundle()
        fs.mkdir staticRoot, 0777, (err) ->
          fs.mkdir staticPath, 0777, (err) ->
            finish()
