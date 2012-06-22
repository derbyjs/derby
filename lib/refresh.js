var escapeHtml = require('html-util').escapeHtml
  , errors = {};

exports.errorHtml = errorHtml;
exports.autoRefresh = autoRefresh;

function errorHtml(errors) {
  var text = ''
    , type, err;
  for (type in errors) {
    err = errors[type];
    text += '<h3>' + escapeHtml(type) + ' Error</h3><pre>' + escapeHtml(err) + '</pre>';
  }
  if (!text) return;
  return '<div id=$_derbyError style="position:absolute;background:rgba(0,0,0,.7);top:0;left:0;right:0;bottom:0;text-align:center">' +
    '<div style="background:#fff;padding:20px 40px;margin:60px;display:inline-block;text-align:left">' +
    text + '</div></div>';
}

function autoRefresh(view, model, appHash) {
  var socket = model.socket;

  model.on('connectionStatus', function(connected, canConnect) {
    if (!canConnect) window.location.reload(true);
  });
  socket.on('connect', function() {
    socket.emit('derbyClient', appHash, function(reload) {
      if (reload) window.location.reload(true);
    });
  });

  socket.on('refreshCss', function(err, css) {
    var el = document.getElementById('$_css');
    if (el) el.innerHTML = css;
    updateError('CSS', err);
  });

  socket.on('refreshHtml', function(err, templates, instances, libraryData) {
    view._makeAll(templates, instances);
    view._makeComponents(libraryData);
    try {
      view.dom._preventUpdates = true;
      view.history.refresh();
    } catch (_err) {
      err || (err = _err.stack);
    }
    updateError('Template', err);
  });
}

function updateError(type, err) {
  if (err) {
    errors[type] = err;
  } else {
    delete errors[type];
  }
  var el = document.getElementById('$_derbyError')
    , html = errorHtml(errors)
    , fragment, range;
  if (html) {
    if (el) {
      el.outerHTML = html;
    } else {
      range = document.createRange();
      range.selectNode(document.body);
      fragment = range.createContextualFragment(html);
      document.body.appendChild(fragment);
    }
  } else {
    if (el) el.parentNode.removeChild(el);
  }
}
