var files = require('./files')
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
  if (!store.sockets) {
    store.once('setSockets', function() {
      autoRefresh(store, options, view);
    });
    return;
  }

  var views = store._derbyRefreshViews || (store._derbyRefreshViews = [])
    , listeners;

  if (views.indexOf(view) !== -1) return;

  views.push(view);
  listeners = {};

  store.sockets.on('connection', function(socket) {
    socket.on('derbyClient', function(appHash, callback) {
      var reload = true
        , view, i, appFilename, sockets;
      for (i = views.length; i--;) {
        view = views[i];
        if (view._appHash === appHash) {
          reload = false;
          break;
        }
      }
      callback(reload);
      if (reload) return;

      appFilename = view._appFilename;
      if (listeners[appFilename]) {
        return listeners[appFilename].push(socket);
      }

      sockets = listeners[appFilename] = [socket];
      var parsed = files.parseName(appFilename, options)
        , root = parsed.root
        , rootLen = root.length
        , clientName = parsed.clientName;
      addWatches(root, root, clientName, sockets, view);
      view._libraries.forEach(function(library) {
        var watchRoot = library.root
          , pre = watchRoot.slice(0, rootLen)
          , post = watchRoot.slice(rootLen)
        // If the compoent is within the root directory and not under a
        // node_modules directory, it's files will be watched already
        if (pre === root && post.indexOf('/node_modules/') === -1) return;
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
