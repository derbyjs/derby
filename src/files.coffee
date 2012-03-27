{dirname, basename, join, exists, relative} = require 'path'
fs = require 'fs'
crypto = require 'crypto'
stylus = require 'stylus'
nib = require 'nib'
racer = require 'racer'
Promise = require 'racer/lib/Promise'
{finishAfter} = require 'racer/lib/util/async'
{parse: parseHtml} = require './html'
{trim} = require './View'

module.exports =

  css: (root, clientName, compress, callback) ->
    findPath root + '/styles', clientName, '.styl', (path) ->
      return callback '' unless path
      fs.readFile path, 'utf8', (err, styl) ->
        return callback err if err
        stylus(styl)
          .use(nib())
          .set('filename', path)
          .set('compress', compress)
          .render callback

  templates: (root, clientName, callback) ->
    count = 0
    calls =
      incr: -> count++
      finish: (err, templates, instances) ->
        if err
          calls.finish = ->
          return callback err
        --count || callback null, templates, instances
    loadTemplates root + '/views', clientName, 'import', calls

  js: (parentFilename, callback) ->
    inlineFile = join dirname(parentFilename), 'inline.js'
    js = inline = null
    finish = finishAfter 2, (err) ->
      callback err, js, inline
    racer.js {require: parentFilename}, (err, value) ->
      js = value
      finish err
    fs.readFile inlineFile, 'utf8', (err, value) ->
      inline = value
      # Ignore file not found error
      err = null if err && err.code is 'ENOENT'
      finish err

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
      require: './' + basename parentFilename
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
    finish = -> fs.writeFile filePath, js, (err) -> callback err, jsFile, hash

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

findPath = (root, name, extension, callback) ->
  if name.charAt(0) isnt '/'
    name = join root, name
  path = name + extension
  exists path, (value) ->
    return callback path  if value
    path = join name, 'index' + extension
    exists path, (value) ->
      callback if value then path else null

loadTemplates = (root, fileName, get, calls, files, templates, instances, alias, currentNs = '') ->
  calls.incr()
  findPath root, fileName, '.html', (path) ->
    if path is null
      if !files
        # Return without doing anything if the path isn't found, and this is the
        # initial automatic lookup based on the clientName
        return calls.finish null, {}, {}
      else
        return calls.finish new Error "Can't find file #{fileName}"

    files ||= {}
    templates ||= {}
    instances ||= {}

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
      fs.readFile path, 'utf8', (err, file) ->
        promise.resolve err, file

    promise.on (err, file) ->
      calls.finish err if err
      parseTemplateFile root, dirname(path), path, calls, files, templates, instances, alias, currentNs, matchesGet, file
      calls.finish new Error "Can't find template '#{get}' in #{path}"  unless got
      calls.finish null, templates, instances

parseTemplateFile = (root, dir, path, calls, files, templates, instances, alias, currentNs, matchesGet, file) ->
  name = src = ns = as = importTemplates = null
  relativePath = relative root, path
  parseHtml file,

    start: (tag, tagName, attrs) ->
      name = src = ns = as = importTemplates = null
      i = tagName.length - 1
      name = (if tagName.charAt(i) == ':' then tagName[0...i] else '').toLowerCase()
      if name is 'import'
        {src, ns, as, template} = attrs
        calls.finish new Error "Template import in #{path} must have a 'src' attribute" unless src

        if template
          importTemplates = template.toLowerCase().split(' ')
          if importTemplates.length > 1 && as?
            calls.finish new Error "Template import of '#{src}' in #{path} can't specify multiple 'template' values with 'as'"

        ns = if 'ns' of attrs
          calls.finish new Error "Template import of '#{src}' in #{path} can't specifiy both 'ns' and 'as' attributes" if as
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
          calls.finish new Error "Template import of '#{src}' in #{path} can't contain content"
        toGet = importTemplates || 'import'
        return loadTemplates root, join(dir, src), toGet, calls, files, templates, instances, as, ns

      templateName = relativePath + ':' + name
      instanceName = alias || name
      instanceName = currentNs + ':' + instanceName if currentNs
      instances[instanceName] = templateName

      return if templates[templateName]
      unless name && literal
        return if onlyWhitespace.test text
        calls.finish new Error "Can't read template in #{path} near the text: #{text}"
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
