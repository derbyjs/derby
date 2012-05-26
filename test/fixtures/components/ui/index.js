var config = {
  filename: __filename
, scripts: {
    dropdown: require('./dropdown')
  }
}

module.exports = plugin
plugin.decorate = 'derby'

function plugin(derby, options) {
  derby.createLibrary(config, options)
}
