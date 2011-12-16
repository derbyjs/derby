# TODO: There are some magic numbers in this file having to do
# with node offsets that should be passed in as options

dragging = null
onRowMove = onColMove = ->

module.exports =

  targetIndex: targetIndex = (e, levels) ->
    item = e.target
    item = item.parentNode while levels--
    for child, i in item.parentNode.childNodes
      return i if child == item

  init: (app, options) ->
    addListener = app.view.dom.addListener
    addListener document, 'mousemove', onMove
    addListener document, 'mouseup', onUp
    {onRowMove, onColMove} = options

    app.rowDown = (e) ->
      el = e.target.parentNode
      index = targetIndex(e, 1) - 2
      dragStart e, el, index, cloneRow, setTop, breakTop, '.row', finishRow
    app.colDown = (e) ->
      el = e.target
      index = targetIndex(e) - 2
      dragStart e, el, index, cloneCol, setLeft, breakLeft, '.col', finishCol

onMove = (e) ->
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

onUp = (e) ->
  return unless dragging
  dragging.finish()
  document.body.removeChild dragging.container
  dragging = null

dragStart = (e, el, index, cloneFn, setFn, breakFn, selector, finish) ->
  e.preventDefault?()
  container = document.createElement 'table'
  container.style.position = 'absolute'
  parent = el.parentNode
  rect = el.getBoundingClientRect()
  clone = cloneFn container, el, rect, parent, index
  offsetLeft = rect.left - e.clientX
  offsetTop = rect.top - e.clientY
  dragging = {el, parent, clone, index, last: index, setFn, breakFn, selector, offsetLeft, offsetTop, finish, container}
  setLeft.call dragging, e
  setTop.call dragging, e
  document.body.appendChild container

setLeft = (e) ->
  loc = e.clientX
  @container.style.left = (loc + window.pageXOffset + @offsetLeft) + 'px'
  return loc
setTop = (e) ->
  loc = e.clientY
  @container.style.top = (loc + window.pageYOffset + @offsetTop) + 'px'
  return loc

breakLeft = (el) -> el && (
    rect = el.getBoundingClientRect()
    rect.width / 2 + rect.left
  )
breakTop = (el) -> el && (
    rect = el.getBoundingClientRect()
    rect.height / 2 + rect.top
  )

cloneRow = (container, el, rect, parent) ->
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
cloneCol = (container, el, rect, parent, index) ->
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
  # Put things back where they started
  @parent.removeChild @clone
  @parent.insertBefore dragging.el, @parent.childNodes[@index + 2]
  # Actually do the move
  onRowMove @index, @last

finishCol = ->
  # Put things back where they started
  @parent.removeChild @clone
  rows = @parent.parentNode.children
  cloneRows = @container.firstChild.children
  index = @index
  for row, i in rows
    row.insertBefore cloneRows[i].firstChild, row.childNodes[index + 2]
  # Actually do the move
  onColMove index, @last
