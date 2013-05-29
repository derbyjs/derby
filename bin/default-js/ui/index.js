var config = {
  filename: __filename
, styles: '../styles/ui'
, scripts: {
    connectionAlert: require('./connectionAlert')
  }
};

module.exports = function(app, options) {
  app.createLibrary(config, options);
};
