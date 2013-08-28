port = process.env.PORT || 3000
require('derby').run __dirname + '/src/server/index.coffee', port
