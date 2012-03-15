{dirname, basename, join, exists} = require 'path'
fs = require 'fs'
crypto = require 'crypto'
stylus = require 'stylus'
nib = require 'nib'
{Promise} = racer = require 'racer'
{parse: parseHtml} = require './html'
{trim} = require './View'

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
            callback trim css

  templates: (root, clientName, callback) ->
    loadTemplates root, clientName, 'import', callback

  js: (parentFilename, callback) ->
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

  hashFile: hashFile = (s) ->
    hash = crypto.createHash('md5').update(s).digest('base64')
    # Base64 uses characters reserved in URLs and adds extra padding charcters.
    # Replace "/" and "+" with the unreserved "-" and "_" and remove "=" padding
    return hash.replace /[\/\+=]/g, (match) ->
      switch match
        when '/' then '-'
        when '+' then '_'
        when '=' then ''

  writeJs: (root, js, options, callback) ->
    staticRoot = options.staticRoot || join root, 'public'
    staticDir = options.staticDir || 'gen'
    staticPath = join staticRoot, staticDir

    hash = hashFile js
    filename = hash + '.js'
    jsFile = join '/', staticDir, filename
    filePath = join staticPath, filename
    finish = -> fs.writeFile filePath, js, -> callback jsFile, hash

    exists staticPath, (value) ->
      return finish() if value

      exists staticRoot, (value) ->
        if value then return fs.mkdir staticPath, 0777, (err) ->
          finish()
        fs.mkdir staticRoot, 0777, (err) ->
          fs.mkdir staticPath, 0777, (err) ->
            finish()

  watch: (dir, type, onChange) ->
    options = interval: 100
    extension = extensions[type]
    files(dir, extension).forEach (file) ->
      fs.watchFile file, options, (curr, prev) ->
        onChange file  if prev.mtime < curr.mtime


onlyWhitespace = /^[\s\n]*$/

findPath = (root, name, dir, extension, callback) ->
  if name.charAt(0) isnt '/'
    name = join root, dir, name
  path = name + extension
  exists path, (value) ->
    return callback path  if value
    path = join name, 'index' + extension
    exists path, (value) ->
      callback if value then path else null

loadTemplates = (root, fileName, get, callback, templates = {}, files = {}, alias, currentNs = '') ->
  callback.count = (callback.count || 0) + 1
  findPath root, fileName, 'views', '.html', (path) ->
    unless path
      # Return without doing anything if the path isn't found, and this is the
      # initial lookup based on the clientName. Otherwise, throw an error
      if fileName then return callback {}
      else throw new Error "Can't find #{root}/views/#{fileName}"

    got = false
    if get is 'import'
      matchesGet = ->
        got = true
        return true
    else if Array.isArray(get)
      getCount = get.length
      matchesGet = (name) ->
        --getCount || got = true
        return ~get.indexOf(name)
    else
      matchesGet = (name) ->
        got = true
        return get == name

    unless promise = files[path]
      promise = files[path] = new Promise
      console.log path
      fs.readFile path, 'utf8', (err, file) ->
        promise.resolve err, file

    promise.on (err, file) ->
      throw err if err
      parseTemplateFile root, dirname(path), templates, files, alias, currentNs, matchesGet, file, path, callback
      throw new Error "Can't find template '#{get}' in #{path}"  unless got
      callback templates unless --callback.count

parseTemplateFile = (root, dir, templates, files, alias, currentNs, matchesGet, file, path, callback) ->
  name = src = ns = as = importTemplates = null
  parseHtml file,

    start: (tag, tagName, attrs) ->
      name = src = ns = as = importTemplates = null
      i = tagName.length - 1
      name = (if tagName.charAt(i) == ':' then tagName[0...i] else '').toLowerCase()
      if name is 'import'
        {src, ns, as, template} = attrs
        throw new Error "Template import in #{path} must have a 'src' attribute" unless src

        if template
          importTemplates = template.toLowerCase().split(' ')
          if importTemplates.length > 1 && as?
            throw new Error "Template import of '#{src}' in #{path} can't specify multiple 'template' values with 'as'"

        ns = if 'ns' of attrs
          throw new Error "Template import of '#{src}' in #{path} can't specifiy both 'ns' and 'as' attributes" if as
          # Import into the namespace specified via 'ns' underneath
          # the current namespace
          if ns
            if currentNs then currentNs + ':' + ns else ns
          else
            currentNs
        else if as
          # If 'as' is specified, import into the current namespace
          currentNs
        else
          # If no namespace is specified, use the src as a namespace.
          # Remove leading '.' and '/' characters
          srcNs = src.replace /^[.\/]*/, ''
          if currentNs then currentNs + ':' + srcNs else srcNs
        ns = ns.toLowerCase()

    chars: (text, literal) ->
      return unless matchesGet name
      if src
        unless onlyWhitespace.test text
          throw new Error "Template import of '#{src}' in #{path} can't contain content"
        toGet = importTemplates || 'import'
        return loadTemplates root, join(dir, src), toGet, callback, templates, files, as, ns
      unless name && literal
        return if onlyWhitespace.test text
        throw new Error "Can't read template in #{path} near the text: #{text}"
      templateName = alias || name
      templateName = currentNs + ':' + templateName if currentNs
      templates[templateName] = trim text

extensions =
  html: /\.html$/
  css: /\.styl$|\.css$/
  js: /\.js$/

ignoreDirectories = ['node_modules', '.git', 'gen']
ignored = (path) -> ignoreDirectories.indexOf(path) == -1

files = (dir, extension, out = []) ->
  fs.readdirSync(dir)
    .filter(ignored)
    .forEach (p) ->
      p = join dir, p
      if fs.statSync(p).isDirectory()
        files p, extension, out
      else if extension.test p
        out.push p

  return out
