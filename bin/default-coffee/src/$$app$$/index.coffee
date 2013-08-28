app = require('derby').createApp(module)
  .use(require 'derby-ui-boot')
  .use(require '../../ui/index.coffee')


# ROUTES #

# Derby routes are rendered on the client and the server
app.get '/', (page) ->
  page.render 'home'

app.get '/list', (page, model, params, next) ->
  # This value is set on the server in the `createUserId` middleware
  userId = model.get '_session.userId'

  # Create a scoped model, which sets the base path for all model methods
  user = model.at 'users.' + userId

  # Create a mongo query that gets the current user's items
  itemsQuery = model.query 'items', {userId}

  # Get the inital data and subscribe to any updates
  model.subscribe user, itemsQuery, (err) ->
    return next err if err

    # Create references that can be used in templates or controller methods
    model.ref '_page.user', user
    itemsQuery.ref '_page.items'

    user.increment 'visits'
    page.render 'list'


# CONTROLLER FUNCTIONS #

app.fn 'list.add', (e, el) ->
  newItem = @model.del '_page.newItem'
  return unless newItem
  newItem.userId = @model.get '_session.userId'
  @model.add 'items', newItem

app.fn 'list.remove', (e) ->
  item = e.get ':item'
  @model.del 'items.' + item.id
