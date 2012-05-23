var scripts = {
  dropdown: require('./dropdown')
}

module.exports = plugin
plugin.decorate = 'derby'

function plugin(derby, options) {
  derby.createLibrary(__filename, scripts, options)
}
