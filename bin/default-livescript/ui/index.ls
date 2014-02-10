config =
  filename: __filename
  styles: '../styles/ui'
  scripts:
    connectionAlert: require './connectionAlert/index.coffee'

module.exports = (app, options) ->
  app.createLibrary config, options
