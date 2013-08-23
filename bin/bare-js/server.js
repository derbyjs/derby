var port = process.env.PORT || 3000;
require('derby').run(__dirname + '/lib/server', port);
