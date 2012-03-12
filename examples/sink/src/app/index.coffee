{get, view, ready} = app = require('derby').createApp module
sortableTable = require './sortableTable'

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
  ctx.currentPage = name
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
    page.render ctxFor 'liveCss'

get '/table', (page, model) ->
  model.subscribe 'table', (err, table) ->
    table.setNull
      rows: [
        {name: 1, cells: [{}, {}, {}]}
        {name: 2, cells: [{}, {}, {}]}
      ]
      lastRow: 1
      cols: [
        {name: 'A'}
        {name: 'B'}
        {name: 'C'}
      ]
      lastCol: 2
    page.render ctxFor 'tableEditor'

['get', 'post', 'put', 'del'].forEach (method) ->
  app[method] '/submit', (page, model, {body, query}) ->
    args = JSON.stringify {method, body, query}, null, '  '
    page.render ctxFor 'submit', {args}

get '/error', ->
  throw new Error 500

get '/back', (page) ->
  page.redirect 'back'


## Controller functions ##

ready (model) ->

  app.addStyle = ->
    model.push 'liveCss.styles', {}

  app.deleteStyle = (e) ->
    model.at(e.target).remove()

  rows = model.at 'table.rows'
  cols = model.at 'table.cols'

  app.deleteRow = (e) ->
    model.at(e.target).parent(2).remove()

  app.deleteCol = (e) ->
    # TODO: Make these move operations atomic when Racer has atomic support
    i = model.at(e.target).leaf()
    row = rows.get 'length'
    while row--
      rows.remove "#{row}.cells", i
    cols.remove i

  app.addRow = ->
    name = model.incr('table.lastRow') + 1
    cells = []
    col = cols.get 'length'
    while col--
      cells.push {}
    rows.push {name, cells}

  alpha = (num, out = '') ->
    mod = num % 26
    out = String.fromCharCode(65 + mod) + out
    if num = Math.floor num / 26
      return alpha num - 1, out
    else
      return out

  app.addCol = ->
    row = rows.get 'length'
    while row--
      rows.push "#{row}.cells", {}
    name = alpha model.incr 'table.lastCol'
    cols.push {name}

  sortableTable.init app,
    onRowMove: (from, to) ->
      rows.move from, to
    onColMove: (from, to) ->
      # TODO: Make these move operations atomic when Racer has atomic support
      cols.move from, to
      row = rows.get 'length'
      while row--
        rows.move "#{row}.cells", from, to
