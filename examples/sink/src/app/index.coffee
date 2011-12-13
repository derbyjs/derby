{get, view, ready} = sink = require('derby').createApp module

## Routing ##

pages = [
  {name: 'home', text: 'Home', url: '/'}
  {name: 'liveCss', text: 'Live CSS', url: '/live-css'}
  {name: 'tableEditor', text: 'Table editor', url: '/table'}
  {name: 'submit', text: 'Submit form', url: '/submit'}
  {name: 'back', text: 'Back redirect', url: '/back'}
  {name: 'error', text: 'Error test', url: '/error'}
]
ctxFor = (name, ctx = {}) ->
  ctx[name + 'Visible'] = true
  last = pages.length - 1
  ctx.pages = for page, i in pages
    page = Object.create page
    if page.name is name
      page.current = true
      ctx.title = page.text
    page.last = i is last
    page
  return ctx

get '/', (page) ->
  page.render ctxFor 'home'

get '/live-css', (page, model) ->
  model.subscribe 'liveCss', ->
    model.setNull 'liveCss.styles', [
      {prop: 'color', value: '#c00', active: true}
      {prop: 'font-weight', value: 'bold', active: true}
      {prop: 'font-size', value: '18px', active: false}
    ]
    model.setNull 'liveCss.outputText', 'Edit this text...'
    page.render ctxFor 'liveCss'

get '/table', (page, model) ->
  model.subscribe 'rows', 'cols', ->
    unless model.get 'rows'
      model.set 'rows', [
        {name: 'A', cells: [{}, {}, {}]}
        {name: 'B', cells: [{}, {}, {}]}
      ]
      model.set 'cols', [
        {name: 1}
        {name: 2}
        {name: 3}
      ]
    page.render ctxFor 'tableEditor'

['get', 'post', 'put', 'del'].forEach (method) ->
  sink[method] '/submit', (page, model, {body, query}) ->
    args = JSON.stringify {method, body, query}, null, '  '
    page.render ctxFor 'submit', {args}

get '/error', ->
  throw new Error 500

get '/back', (page) ->
  page.redirect 'back'


## Controller functions ##

ready (model) ->
  exports.addStyle = ->
    model.push 'liveCss.styles', {}

  targetIndex = (e, levels = 1) ->
    item = e.target
    item = item.parentNode while levels--
    for child, i in item.parentNode.childNodes
      return i if child == item

  exports.deleteStyle = (e) ->
    model.remove 'liveCss.styles', targetIndex(e)

  exports.deleteRow = (e) ->
    model.remove 'rows', targetIndex(e, 2)

  exports.deleteCol = (e) ->
    # Have to subtract 2, because the first node is the <th> in the first
    # column, and the second node is the comment wrapper for the binding
    i = targetIndex(e) - 2

    row = model.get('rows').length
    while row--
      model.remove "rows.#{row}.cells", i
    return model.remove 'cols', i
