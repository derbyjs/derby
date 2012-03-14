{get, ready} = app = require './index'
{render} = require './shared'

get '/live-css', (page, model) ->
  model.subscribe 'liveCss', (err, liveCss) ->
    liveCss.setNull
      styles: [
        {prop: 'color', value: '#c00', active: true}
        {prop: 'font-weight', value: 'bold', active: true}
        {prop: 'font-size', value: '18px', active: false}
      ]
      outputText: 'Edit this text...'
    model.fn '_numStyles', 'liveCss.styles', (styles) ->
      for style in styles
        return true if style.active
      return false
    model.del '_poppedOut'
    render page, 'liveCss'

get from: '/live-css', to: '/live-css/popout',
  forward: (model) ->
    model.set '_poppedOut', true
  back: (model) ->
    model.del '_poppedOut'


ready (model) ->

  app.addStyle = ->
    model.push 'liveCss.styles', {}

  app.deleteStyle = (e) ->
    model.at(e.target).remove()
