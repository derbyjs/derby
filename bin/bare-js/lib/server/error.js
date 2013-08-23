var path = require('path');
var derby = require('derby');

module.exports = function() {
  var staticPages = derby.createStatic(path.dirname(path.dirname(__dirname)));

  return function(err, req, res, next) {
    if (err == null) return next();

    console.log(err.stack ? err.stack : err);

    // Customize error handling here
    var message = err.message || err.toString();
    var status = parseInt(message);
    status = (status >= 400 && status < 600) ? status : 500;

    if (status === 403 || status === 404 || status === 500) {
      staticPages.render('error', res, status.toString(), status);
    } else {
      res.send(status);
    }
  };
};
