var app = require('derby').createApp(module)
  .use(require('../../ui'))

app.get('/', function(page) {
  page.render();
});
