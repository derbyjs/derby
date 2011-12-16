{get, view, ready} = app = require('derby').createApp module
{targetIndex} = sortableTable = require './sortableTable'

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
  model.subscribe 'liveCss', ->
    model.setNull 'liveCss.styles', [
      {prop: 'color', value: '#c00', active: true}
      {prop: 'font-weight', value: 'bold', active: true}
      {prop: 'font-size', value: '18px', active: false}
    ]
    model.setNull 'liveCss.outputText', 'Edit this text...'
    page.render ctxFor 'liveCss'

get '/table', (page, model) ->
  model.subscribe 'table', ->
    unless model.get 'table'
      model.set 'table', 
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
    model.remove 'liveCss.styles', targetIndex(e.target, 1)

  app.deleteRow = (e) ->
    # Have to subtract 2 from index, because the first node is the <tr>
    # in the first row, and the second node is the comment binding wrapper
    model.remove 'table.rows', targetIndex(e.target, 2) - 2

  app.deleteCol = (e) ->
    # Have to subtract 2 from index, because the first node is the <td>
    # in the first col, and the second node is the comment binding wrapper
    i = targetIndex(e.target, 1) - 2
    row = model.get('table.rows').length
    while row--
      model.remove "table.rows.#{row}.cells", i
    model.remove 'table.cols', i

  app.addRow = ->
    name = model.incr('table.lastRow') + 1
    cells = []
    col = model.get('table.cols').length
    while col--
      cells.push {}
    model.push 'table.rows', {name, cells}

  alpha = (num, out = '') ->
    mod = num % 26
    out = String.fromCharCode(65 + mod) + out
    if num = Math.floor num / 26
      return alpha num - 1, out
    else
      return out

  app.addCol = ->
    row = model.get('table.rows').length
    while row--
      model.push "table.rows.#{row}.cells", {}
    name = alpha model.incr 'table.lastCol'
    model.push 'table.cols', {name}

  sortableTable.init app,
    onRowMove: (from, to) ->
      model.move 'table.rows', from, to
    onColMove: (from, to) ->
      # TODO: Make these move operations atomic when Racer has atomic support
      model.move 'table.cols', from, to
      for i in [0...model.get('table.rows').length]
        model.move "table.rows.#{i}.cells", from, to
