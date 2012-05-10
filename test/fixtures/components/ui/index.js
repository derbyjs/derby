module.exports = plugin
plugin.decorate = 'derby'
plugin.useWith = {server: true, browser: false}

function plugin(derby, options) {
  var ui = derby.createLibrary(module, options)
}
