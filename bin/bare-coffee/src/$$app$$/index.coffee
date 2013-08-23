app = require('derby').createApp(module)
  .use(require '../../ui/index.coffee')

app.get '/', (page) ->
  page.render 'home'
