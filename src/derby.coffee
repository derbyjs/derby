fs = require 'fs'
path = require 'path'
http = require 'http'
racer = require 'racer'
up = require 'up'
View = require './View.server'
{autoRefresh} = require './refresh.server'
{addHttpMethods} = require './router.server'
{mergeAll, isProduction} = racer.util

derby = module.exports = mergeAll Object.create(racer),
  options: {}

  run: (file, port, options = {numWorkers: 1}) ->
    # Resolve relative filenames
    file = path.resolve file
    port ?= if isProduction then 80 else 3000

    try
      server = require file
    catch e
      console.error "Error requiring server module from `#{file}`"
      throw e

    unless server instanceof http.Server
      throw new Error "`#{file}` does not export a valid `http.Server`"

    unless isProduction
      # TODO: This extends the internal API of Up. It would be better
      # if Up supported workers being able to force a global reload
      onMessage = up.Worker::onMessage
      up.Worker::onMessage = (message) ->
        return upService.reload()  if message.type is 'reload'
        onMessage.call this, message

    master = http.createServer().listen port
    upService = up master, file, options
    process.on 'SIGUSR2', ->
      console.log 'SIGUSR2 signal detected - reloading'
      upService.reload()

    console.log "Starting cluster with %d workers in %s mode",
      options.numWorkers, process.env.NODE_ENV
    console.log "`kill -s SIGUSR2 %s` to force cluster reload", process.pid
    console.log "Go to: http://localhost:%d/", port

  createApp: (appModule) ->
    appExports = appModule.exports
    # Expose methods on the application module
    appExports.view = view = new View
    appExports.render = (res, model, ns, ctx, status) -> view.render res, model, ns, ctx, status
    appExports.ready = ->

    view._derbyOptions = options = @options
    view._appFilename = appModule.filename

    store = null
    session = null
    createModel = -> store.createModel()
    appExports._setStore = setStore = (_store) ->
      autoRefresh _store, options, view
      session?._setStore _store
      return store = _store
    appExports.createStore = (options) -> setStore racer.createStore options
    appExports.session = -> session = racer.session store

    addHttpMethods appExports, view, createModel

    process.nextTick -> view.render()

    return appExports

  createStatic: (root) ->
    return new Static root

  createStore: (args...) ->
    last = args[args.length - 1]
    # Check to see if last argument is a createStore options object
    options = args.pop()  unless last.view
    store = racer.createStore options
    app._setStore store  for app in args
    return store

  use: (plugin, opts) ->
    switch plugin.decorate
      when 'racer'
        plugin racer, opts
      when 'derby'
        plugin this, opts
      else
        throw new Error 'plugin.decorate must be either "racer" or "derby"'
    return this # chainable

Object.defineProperty derby, 'version',
  get: -> JSON.parse(fs.readFileSync __dirname + '/../package.json', 'utf8').version


Static = (@root) ->
  @views = {}
  return
Static:: =
  render: (name, res, model, ns, ctx, status) ->
    unless view = @views[name]
      view = @views[name] = new View
      view._root = @root
      view._clientName = name
    view.render res, model, ns, ctx, status, true
