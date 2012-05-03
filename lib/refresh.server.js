var isProduction = require('racer').util.isProduction
  , files = require('./files')
  , refresh = module.exports = require('./refresh');

refresh.cssError = cssError;
refresh.templateError = templateError;
refresh.autoRefresh = autoRefresh;

function cssError(err) {
  if (err.stack) {
    console.error('\nCSS PARSE ERROR\n' + err.stack);
    return err.stack;
  } else {
    console.error('\nCSS PARSE ERROR\n' + err.message + '\n' + err.filename);
    return err.message + '\n' + err.filename;
  }
}

function templateError(err) {
  console.error('\nTEMPLATE ERROR\n' + err.stack);
  return err.stack;
}

function autoRefresh(store, options, view) {
  if (isProduction || store._derbySocketsSetup) return;
  store._derbySocketsSetup = true;
  var listeners = {};

  store.sockets.on('connection', function(socket) {
    socket.on('derbyClient', function(appHash, callback) {
      var appFilename, reload, sockets;
      reload = appHash !== view._appHash;
      callback(reload);
      if (reload) return;

      appFilename = view._appFilename;
      if (listeners[appFilename]) {
        return listeners[appFilename].push(socket);
      }

      sockets = listeners[appFilename] = [socket];
      addWatches(appFilename, options, sockets, view);
    });
  });
}

function addWatches(appFilename, options, sockets, view) {
  var parsed = files.parseName(appFilename, options)
    , root = parsed.root
    , clientName = parsed.clientName;

  files.watch(root, 'css', function() {
    files.css(root, clientName, false, function(err, css) {
      var errText;
      if (err) {
        errText = cssError(err);
        css = '';
      }
      for (var i = sockets.length; i--;) {
        sockets[i].emit('refreshCss', errText, css);
      }
    });
  });

  files.watch(root, 'html', function() {
    files.templates(root, clientName, function(err, templates, instances) {
      var errText;
      if (err) {
        errText = templateError(err);
        templates = {};
        instances = {};
      }
      view.clear();
      view._makeAll(templates, instances);
      for (var i = sockets.length; i--;) {
        sockets[i].emit('refreshHtml', errText, templates, instances);
      }
    });
  });

  files.watch(root, 'js', function() {
    process.send({type: 'reload'});
  });
}
