exports.setup = function(library) {
  library.view.fn('sentenceCase', function(text) {
    return text && (text.charAt(0).toUpperCase() + text.slice(1));
  });
};

exports.reconnect = function() {
  var model = this.model;
  // Hide the reconnect link for a second after clicking it
  model.set('hideReconnect', true);
  setTimeout(function() {
    model.set('hideReconnect', false);
  }, 1000);
  model.reconnect();
};

exports.reload = function() {
  window.location.reload();
};
