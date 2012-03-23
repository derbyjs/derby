module.exports =

  autoRefresh: (view, model, appFilename, appHash) ->
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
      updateError 'CSS', err

    socket.on 'refreshHtml', (err, templates, instances) ->
      view.clear()
      view._makeAll templates, instances
      try
        view.history.refresh()
      catch _err
        err ||= _err
      updateError 'Template', err

  errorHtml: errorHtml = (errors) ->
    text = ''
    for type, err of errors
      text += '<h3>' + type + ' Error</h3><pre>' + err + '</pre>'
    return unless text
    return '<div id=$_derbyError style="position:absolute;background:rgba(0,0,0,.7);top:0;left:0;right:0;bottom:0;text-align:center">' +
        '<div style="background:#fff;padding:20px 40px;margin:60px;display:inline-block;text-align:left">' +
          text +
        '</div>' +
      '</div>'

errors = {}
updateError = (type, err) ->
  if err then errors[type] = err else delete errors[type]

  el = document.getElementById '$_derbyError'
  if html = errorHtml errors
    if el
      el.outerHTML = html
    else
      range = document.createRange()
      range.selectNode document.body
      fragment = range.createContextualFragment html
      document.body.appendChild fragment
    return
  el.parentNode.removeChild el if el
