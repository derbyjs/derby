{get, view, ready} = require('derby').createApp module


## ROUTES ##

get '/', (page) ->
  page.redirect '/derby'

get '/:group', (page, model, {group}) ->
  # TODO: This subscribes to all todos in all groups. Only subscribe
  # todos for this group once query subscriptions are supported
  model.subscribe _group: "groups.#{group}", 'todos', 'nextId', ->

    # The refList supports array methods, but it stores the todo values
    # on an object by id. The todos are stored on the object 'todos',
    # and their order is stored in an array of ids at '_group.todoIds'.
    model.refList '_todoList', 'todos', '_group.todoIds'

    # Render right away if this group already has a todo list
    return page.render()  if model.get '_group.todoIds'

    # Otherwise, add some default todos
    nextId = model.at 'nextId'
    model.push '_todoList',
      {id: nextId.incr(), completed: false, text: 'Example todo'},
      {id: nextId.incr(), completed: false, text: 'Another example'},
      {id: nextId.incr(), completed: true, text: 'This one is done already'}
    page.render()


## CONTROLLER FUNCTIONS ##

ready (model) ->

  list = model.at '_todoList'

  # Make the list draggable using jQuery UI
  ul = $('#todos')
  ul.sortable
    handle: '.handle'
    axis: 'y'
    containment: '#dragbox'
    update: (e, ui) ->
      item = ui.item[0]
      domId = item.id
      id = item.getAttribute 'data-id'
      to = ul.children().index(item)
      # Use the Derby ignore option to suppress the normal move event
      # binding, since jQuery UI will move the element in the DOM
      list.pass(ignore: domId).move {id}, to


  list.on 'set', '*.completed', (i, completed, previous, isLocal) ->
    # Move the item to the bottom if it was checked off
    list.move i, -1  if completed && isLocal

  newTodo = model.at '_newTodo'
  exports.add = ->
    # Don't add a blank todo
    return unless text = view.escapeHtml newTodo.get()
    newTodo.set ''
    # Insert the new todo before the first completed item in the list
    # or append to the end if none are completed
    for todo, i in list.get()
      break if todo.completed
    list.insert i,
      id: model.incr 'nextId'
      completed: false
      text: text

  exports.del = (e) ->
    # refLists accept either ids or indicies for index args
    list.remove id: e.target.getAttribute 'data-id'


  showReconnect = model.at '_showReconnect'
  showReconnect.set true
  exports.connect = ->
    showReconnect.set false
    setTimeout (-> showReconnect.set true), 1000
    model.socket.socket.connect()

  exports.reload = -> window.location.reload()

  exports.shortcuts = (e) ->
    return unless e.metaKey || e.ctrlKey
    code = e.which
    return unless command = (switch code
      when 66 then 'bold'           # Bold: Ctrl/Cmd + B
      when 73 then 'italic'         # Italic: Ctrl/Cmd + I
      when 32 then 'removeFormat'   # Clear formatting: Ctrl/Cmd + Space
      when 220 then 'removeFormat'  # Clear formatting: Ctrl/Cmd + \
      else null
    )
    document.execCommand command, false, null
    e.preventDefault() if e.preventDefault
    return false

  # Tell Firefox to use elements for styles instead of CSS
  # See: https://developer.mozilla.org/en/Rich-Text_Editing_in_Mozilla
  document.execCommand 'useCSS', false, true
  document.execCommand 'styleWithCSS', false, false
