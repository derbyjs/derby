{get, view, ready} = require('derby').createApp module


## ROUTES ##

listPath = '_todoList'

get '/', (page) ->
  page.redirect '/derby'

get '/:group', (page, model, {group}) ->
  model.subscribe _group: "groups.#{group}", ->
    model.setNull "groups.#{group}",
      todos:
        0: {id: 0, completed: true, text: 'This one is done already'}
        1: {id: 1, completed: false, text: 'Example todo'}
        2: {id: 2, completed: false, text: 'Another example'}
      todoIds: [1, 2, 0]
      nextId: 3
    # Currently, refs must be explicitly declared per model; otherwise the ref
    # is not added the model's internal reference indices
    model.set listPath, model.arrayRef '_group.todos', '_group.todoIds'
    page.render()


## CONTROLLER FUNCTIONS ##

ready (model) ->

  # Make the list draggable using jQuery UI
  todoList = $('#todos')
  todoList.sortable
    handle: '.handle'
    axis: 'y'
    containment: '#dragbox'
    update: (e, ui) ->
      item = ui.item[0]
      domId = item.id
      id = item.getAttribute 'data-id'
      to = todoList.children().index(item)
      # Use the Derby ignore option to suppress the normal move event
      # binding, since jQuery UI will move the element in the DOM
      model.with(ignore: domId).move listPath, {id}, to


  model.on 'set', '_todoList.*.completed', (i, value, isLocal) ->
    # Move the item to the bottom if it was checked off
    model.move listPath, i, -1  if value && isLocal

  exports.add = ->
    # Don't add a blank todo
    return unless text = view.htmlEscape model.get '_newTodo'
    model.set '_newTodo', ''
    # Insert the new todo before the first completed item in the list
    for todo, i in list = model.get listPath
      break if todo.completed
    todo = 
      id: model.incr '_group.nextId'
      completed: false
      text: text
    if i == list.length
      # Append to the end if there are no completed items
      model.push listPath, todo
    else
      model.insertBefore listPath, i, todo

  exports.del = (e) ->
    # arrayRef's accept either ids or indicies for index args
    model.remove listPath, id: e.target.getAttribute 'data-id'

  model.set '_showReconnect', true
  exports.connect = ->
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
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
