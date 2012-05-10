// Components must export a create function

// Components are passed a scoped model underneath _$components.{uid}

exports.create = function(self, dom, elements) {
  var container = elements.container
    , open = self.at('open')

  // Listeners added inside of a component should be automatically
  // removed when the instance is removed from the DOM
  dom.addListener(document.documentElement, 'click', function(e) {
    if (!container.contains(e.target)) {
      open.set(false)
    }
  })

  exports.clickButton = function() {
    open.set(!open.get())
  }

  exports.clickMenu = function(e, el) {
    var item = model.at(el)
      , value = item.get()
    open.set(false)
    if (value.text == null) return
    self.set('value', value.text)
    self.set('index', +item.leaf())
  }
}
