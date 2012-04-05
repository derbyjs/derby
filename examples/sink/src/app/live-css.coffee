{get, ready, view} = app = require './index'
{render} = require './shared'

view.fn 'cssProperty', cssProperty = (style) ->
  if style.active then "#{style.prop}: #{style.value};" else ''

get '/live-css', (page, model) ->
  model.subscribe 'liveCss', (err, liveCss) ->
    liveCss.setNull
      styles: [
        {prop: 'color', value: '#c00', active: true}
        {prop: 'font-weight', value: 'bold', active: true}
        {prop: 'font-size', value: '18px', active: false}
      ]
      outputText: 'Edit this text...'
    model.fn '_hasActiveStyles', 'liveCss.styles', (styles) ->
      for style in styles
        return true if style.active
      return false
    model.del '_poppedOut'
    render page, 'liveCss'

# This is a transition route, which defines how to apply an update
# without re-rendering the entire page. Note that going directly to
# '/live-css/popout' will first call the route above and then call
# the forward route below before rendering
get from: '/live-css', to: '/live-css/popout',
  forward: (model) ->
    model.set '_poppedOut', true
  back: (model) ->
    model.del '_poppedOut'


ready (model) ->

  app.liveCss =
    addStyle: ->
      model.push 'liveCss.styles', {}
    deleteStyle: (e, el) ->
      model.at(el).remove()
