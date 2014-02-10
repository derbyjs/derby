config =
  filename: __filename
  styles: '../styles/ui'
  scripts: {}

module.exports = (app, options) ->
  app.createLibrary config, options
