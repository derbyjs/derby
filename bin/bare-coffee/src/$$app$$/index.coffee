app = require('derby').createApp(module)
  .use(require '../../ui/index.coffee')


# ROUTES #

# Derby routes are rendered on the client and the server
app.get '/', (page) ->
  page.render 'home'
