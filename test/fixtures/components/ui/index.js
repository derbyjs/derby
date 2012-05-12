var scripts = {
  dropdown: require('./dropdown')
}

module.exports = plugin
plugin.decorate = 'derby'
plugin.useWith = {server: true, browser: true}

function plugin(derby, options) {
  derby.createLibrary(module, scripts, options)
}
