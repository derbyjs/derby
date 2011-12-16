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
  {addListener} = view.dom

  targetIndex = (e, levels) ->
    item = e.target
    item = item.parentNode while levels--
    for child, i in item.parentNode.childNodes
      return i if child == item

  exports.addStyle = ->
    model.push 'liveCss.styles', {}

  exports.deleteStyle = (e) ->
    model.remove 'liveCss.styles', targetIndex(e, 1)

  exports.deleteRow = (e) ->
    # Have to subtract 2 from index, because the first node is the <tr>
    # in the first row, and the second node is the comment binding wrapper
    model.remove 'table.rows', targetIndex(e, 2) - 2

  exports.deleteCol = (e) ->
    # Have to subtract 2 from index, because the first node is the <td>
    # in the first col, and the second node is the comment binding wrapper
    i = targetIndex(e, 1) - 2
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


  dragging = container = null

  dragStart = (e, el, index, cloneFn, setFn, breakFn, selector, finish) ->
    e.preventDefault?()
    container = document.createElement 'table'
    container.style.position = 'absolute'
    parent = el.parentNode
    rect = el.getBoundingClientRect()
    clone = cloneFn el, rect, parent, index
    offsetLeft = rect.left - e.clientX
    offsetTop = rect.top - e.clientY
    dragging = {el, parent, clone, index, last: index, setFn, breakFn, selector, offsetLeft, offsetTop, finish}
    setLeft.call dragging, e
    setTop.call dragging, e
    document.body.appendChild container

  setLeft = (e) ->
    loc = e.clientX
    container.style.left = (loc + window.pageXOffset + @offsetLeft) + 'px'
    return loc
  setTop = (e) ->
    loc = e.clientY
    container.style.top = (loc + window.pageYOffset + @offsetTop) + 'px'
    return loc

  breakLeft = (el) -> el && (
      rect = el.getBoundingClientRect()
      rect.width / 2 + rect.left
    )
  breakTop = (el) -> el && (
      rect = el.getBoundingClientRect()
      rect.height / 2 + rect.top
    )

  cloneRow = (el, rect, parent) ->
    spacerHtml = '<tr>'
    for child in el.children
      spacerHtml += "<td style=width:#{child.offsetWidth}px;height:0;padding:0>"
    clone = el.cloneNode(false)
    clone.removeAttribute 'id'
    clone.style.height = rect.height + 'px'
    container.innerHTML = clone.innerHTML = spacerHtml
    parent.insertBefore clone, el
    container.firstChild.appendChild el
    return clone
  cloneCol = (el, rect, parent, index) ->
    rows = parent.parentNode.children
    spacerHtml = ''
    for row in rows
      spacerHtml += "<tr class=#{row.className} style=height:#{row.offsetHeight}px;width:0;padding:0>"
    container.innerHTML = spacerHtml
    clone = el.cloneNode(false)
    clone.removeAttribute 'id'
    clone.setAttribute 'rowspan', rows.length
    clone.style.padding = 0
    clone.style.width = rect.width + 'px'
    parent.insertBefore clone, parent.childNodes[index + 3]
    cloneRows = container.firstChild.children
    for row, i in rows
      cloneRows[i].appendChild row.childNodes[index + 2]
    return clone
  
  finishRow = ->
    {parent, clone, index, last} = this
    # Put things back where they started
    parent.removeChild clone
    parent.insertBefore dragging.el, parent.childNodes[index + 2]
    # Actually do the move
    model.move 'table.rows', index, last
  finishCol = ->
    {parent, clone, index, last} = this
    # Put things back where they started
    parent.removeChild clone
    rows = parent.parentNode.children
    cloneRows = container.firstChild.children
    for row, i in rows
      row.insertBefore cloneRows[i].firstChild, row.childNodes[index + 2]
    # Actually do the move
    # TODO: Make these move operations atomic when Racer has atomic support
    model.move 'table.cols', index, last
    for i in [0...model.get('table.rows').length]
      model.move "table.rows.#{i}.cells", index, last

  exports.rowDown = (e) ->
    el = e.target.parentNode
    index = targetIndex(e, 1) - 2
    dragStart e, el, index, cloneRow, setTop, breakTop, '.row', finishRow
  exports.colDown = (e) ->
    el = e.target
    index = targetIndex(e) - 2
    dragStart e, el, index, cloneCol, setLeft, breakLeft, '.col', finishCol

  addListener document, 'mousemove', onMove = (e) ->
    return unless dragging
    {parent, last, breakFn} = dragging
    loc = dragging.setFn e

    i = 0
    children = parent.querySelectorAll dragging.selector
    i++ while loc > breakFn(
      if i < last then children[i] else children[i + 1]
    )
    unless i == last
      unless ref = children[if i < last then i else i + 1]
        ref = children[children.length - 1].nextSibling
      parent.insertBefore dragging.clone, ref
    dragging.last = i

  addListener document, 'mouseup', (e) ->
    return unless dragging
    dragging.finish()
    document.body.removeChild container
    dragging = container = null
