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
  newTodo = $ '#new-todo'

  model.on 'set', '_todoList.*.completed', (i, value) ->
    # Move the item to the bottom if it was checked off
    model.move listPath, i, -1  if value

  exports.add = ->
    # Don't add a blank todo
    return unless text = view.htmlEscape newTodo.val()
    newTodo.val ''
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

  exports.del = (id) ->
      model.remove listPath, id: id

  model.set '_showReconnect', true
  exports.connect = ->
    model.set '_showReconnect', false
    setTimeout (-> model.set '_showReconnect', true), 1000
    model.socket.socket.connect()

  exports.reload = -> window.location.reload()
