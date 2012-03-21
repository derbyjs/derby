racer = require 'racer'
derbyModel = require './derby.Model'
Dom = require './Dom'
View = require './View'
History = require './History'
{addHttpMethods, Page} = require './router'

exports.createApp = (appModule) ->
  appExports = appModule.exports
  appModule.exports = (modelBundle, appHash, ns, ctx, appFilename) ->
    # The init event is fired after the model data is initialized but
    # before the socket object is set
    racer.on 'init', (model) ->
      view.model = model
      view.dom = dom = new Dom model, appExports
      derbyModel.init model, dom
      page = new Page view, model
      history = view.history = new History page, routes, dom
      view.render model, ns, ctx, true

    # The ready event is fired after the model data is initialized and
    # the socket object is set
    racer.on 'ready', (model) ->
      autoRefresh view, model, appFilename, appHash

    racer.init modelBundle
    return appExports

  # Expose methods on the application module. Note that view must added
  # to both appModule.exports and appExports, since it is used before
  # the initialization function to make templates
  appModule.exports.view = appExports.view = view = new View
  routes = addHttpMethods appExports
  appExports.ready = (fn) -> racer.on 'ready', fn
  return appExports


errors = {}
displayErr = (type, err) ->
  if err then errors[type] = err else delete errors[type]
  text = ''
  for type, err of errors
    text += '<h3>' + type + ' Error</h3><pre>' + err + '</pre>'
  el = document.getElementById '$_derbyError'
  if text
    if el
      el.firstChild.firstChild.innerHTML = text
    else
      el = document.createElement 'div'
      el.id = '$_derbyError'
      el.innerHTML =
        '<div style="position:absolute;background:rgba(0,0,0,.7);top:0;left:0;right:0;bottom:0;text-align:center">' +
          '<div style="background:#fff;padding:20px 40px;margin:60px;display:inline-block;text-align:left">' +
            text +
          '</div>' +
        '</div>'
      document.body.appendChild el
    return
  el.parentNode.removeChild el if el

autoRefresh = (view, model, appFilename, appHash) ->
  return unless appFilename

  {socket} = model
  model.on 'connectionStatus', (connected, canConnect) ->
    window.location.reload true  unless canConnect

  socket.on 'connect', ->
    socket.emit 'derbyClient', appFilename, (serverHash) ->
      window.location.reload true  if appHash != serverHash

  socket.on 'refreshCss', (err, css) ->
    el = document.getElementById '$_css'
    el.innerHTML = css  if el
    displayErr 'CSS', err

  socket.on 'refreshHtml', (err, templates, instances) ->
    view.clear()
    view._makeAll templates, instances
    view.history.refresh()
    displayErr 'Template', err
