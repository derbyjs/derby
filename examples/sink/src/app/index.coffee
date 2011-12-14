{get, view, ready} = app = require('derby').createApp module

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
  {addListener} = view.dom

  targetIndex = (e, levels = 1) ->
    item = e.target
    item = item.parentNode while levels--
    for child, i in item.parentNode.childNodes
      return i if child == item

  exports.addStyle = ->
    model.push 'liveCss.styles', {}

  exports.deleteStyle = (e) ->
    model.remove 'liveCss.styles', targetIndex e


  rowIndex = (e) ->
    targetIndex e, 2
  
  colIndex = (e) ->
    # Have to subtract 2, because the first node is the <th> in the first
    # column, and the second node is the comment wrapper for the binding
    targetIndex(e) - 2

  exports.deleteRow = (e) ->
    model.remove 'table.rows', rowIndex e

  exports.deleteCol = (e) ->
    i = colIndex e
    row = model.get('table.rows').length
    while row--
      model.remove "table.rows.#{row}.cells", i
    model.remove 'table.cols', i
  
  exports.addRow = ->
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
  
  exports.addCol = ->
    row = model.get('table.rows').length
    while row--
      model.push "table.rows.#{row}.cells", {}
    name = alpha model.incr 'table.lastCol'
    model.push 'table.cols', {name}


  dragging = null
  dragRow = $ 'drag-row'
  dragCol = $ 'drag-col'
  body = document.body

  dragStart = (e, type, i, el, parent, container) ->
    e.preventDefault?()
    rect = el.getBoundingClientRect()
    dragging =
      type: type
      i: i
      el: el
      parent: parent
      container: container
      offsetLeft: rect.left - e.clientX
      offsetTop: rect.top - e.clientY
      clone: clone = el.cloneNode()
    clone.style.height = rect.height + 'px'
    clone.style.width = rect.width + 'px'
    el.parentNode.insertBefore clone, el
    container.firstChild.appendChild el
    onMove e
    dragRow.style.display = 'table'

  exports.rowDown = (e) ->
    row = e.target.parentNode
    tbody = row.parentNode
    dragStart e, rowIndex(e), 'row', row, tbody, dragRow

  exports.colDown = (e) ->

  addListener document, 'mousemove', onMove = (e) ->
    return unless dragging
    containerStyle = dragging.container.style
    containerStyle.left = (e.clientX + dragging.offsetLeft) + 'px'
    containerStyle.top = (e.clientY + dragging.offsetTop) + 'px'

  addListener document, 'mouseup', (e) ->
    return unless dragging
    dragging.clone.parentNode.removeChild dragging.clone
    dragging.parent.appendChild dragging.el
    dragging.container.display = 'none'
    dragging = null
