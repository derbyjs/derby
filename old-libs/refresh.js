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

function autoRefresh(view, model) {

  model.channel.on('derby:reload', reloadOnReady);
  // Wait to reload until the server is responsive again after restarting
  function reloadOnReady() {
    xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        return window.location.reload(true);
      }
      reloadOnReady();
    };
    xhr.open('GET', window.location.href);
    xhr.send();
  }

  model.channel.on('derby:refreshCss', function(data) {
    var el = document.getElementById('$_css');
    if (el) el.innerHTML = data.css;
    updateError('CSS', data.errText);
  });

  model.channel.on('derby:refreshHtml', function(data) {
    view._makeAll(data.templates, data.instances);
    view._makeComponents(data.libraryData);
    var errText = data.errText;
    try {
      view.app.history.refresh();
    } catch (err) {
      errText || (errText = err.stack);
    }
    updateError('Template', data.errText);
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
