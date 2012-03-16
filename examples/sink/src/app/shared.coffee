pages = [
  {name: 'home', text: 'Home', url: '/'}
  {name: 'liveCss', text: 'Live CSS', url: '/live-css'}
  {name: 'tableEditor', text: 'Table editor', url: '/table'}
  {name: 'sortedList', text: 'Sorted list', url: '/sorted-list'}
  {name: 'submit', text: 'Submit form', url: '/submit'}
  {name: 'back', text: 'Back redirect', url: '/back'}
  {name: 'error', text: 'Error test', url: '/error'}
]

exports.render = (page, name, ctx = {}) ->
  ctx.currentPage = name
  ctx.pages = []
  for item, i in pages
    item = Object.create item
    ctx.pages[i] = item
    if item.name is name
      item.current = true
      ctx.title = item.text
  item.isLast = true
  page.render name, ctx
