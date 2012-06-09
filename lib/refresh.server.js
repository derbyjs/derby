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
      var parsed = files.parseName(appFilename, options)
        , root = parsed.root
        , clientName = parsed.clientName;
      addWatches(root, root, clientName, sockets, view);
      view._libraries.forEach(function(library) {
        addWatches(library.root, root, clientName, sockets, view);
      })
    });
  });
}

function addWatches(watchRoot, root, clientName, sockets, view) {
  files.watch(watchRoot, 'css', function() {
    view._loadCss(root, clientName, function(err, css) {
      var errText;
      if (err) errText = cssError(err);
      for (var i = sockets.length; i--;) {
        sockets[i].emit('refreshCss', errText, css);
      }
    });
  });

  files.watch(watchRoot, 'html', function() {
    view._loadTemplates(root, clientName, function(err, templates, instances, libraryData) {
      var errText;
      if (err) errText = templateError(err);
      for (var i = sockets.length; i--;) {
        sockets[i].emit('refreshHtml', errText, templates, instances, libraryData);
      }
    });
  });

  files.watch(watchRoot, 'js', function() {
    process.send({type: 'reload'});
  });
}
