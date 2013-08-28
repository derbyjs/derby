var config = {
  filename: __filename
, styles: '../styles/ui'
, scripts: {
  }
};

module.exports = function(app, options) {
  app.createLibrary(config, options);
};
