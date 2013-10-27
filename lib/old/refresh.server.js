var chokidar = require('chokidar');
var files = require('./files');
var refresh = module.exports = require('./refresh');

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

function autoRefresh(store, view, isProduction) {
  // Track all clients that connect. This code doesn't cleanup properly, and it
  // should definitely not be used in production
  var clients = [];
  store.on('client', function(client) {
    client.channel.on('derby:app', function(scriptPath) {
      if (scriptPath === view._scriptPath) clients.push(client);
    });
  });

  // Restart the server and reload all browsers when script files change
  var watcher = new chokidar.FSWatcher;
  watcher.on('change', function(path, stats) {
    for (var i = 0; i < clients.length; i++) {
      clients[i].channel.send('derby:reload');
    }
    setTimeout(function() {
      process.send({type: 'reload'});
    }, 0);
  });
  store.on('bundle', function(browserify) {
    browserify.on('file', function(file) {
      watcher.add(file);
    });
  });

  // Live update templates and CSS as they change
  var parsed = files.parseName(view._appFilename)
  var root = parsed.root
  var rootLen = root.length
  var clientName = parsed.clientName;
  addWatches(root, root, clientName, clients, view);
  view._libraries.forEach(function(library) {
    var watchRoot = library.root
    var pre = watchRoot.slice(0, rootLen)
    var post = watchRoot.slice(rootLen)
    // If the compoent is within the root directory and not under a
    // node_modules directory, it's files will be watched already
    if (pre === root && post.indexOf('/node_modules/') === -1) return;
    addWatches(library.root, root, clientName, clients, view);
  });
}

function addWatches(watchRoot, root, clientName, clients, view) {
  files.watch(watchRoot, 'css', function() {
    view._loadStyles(root, clientName, function(err, css) {
      var errText;
      if (err) errText = cssError(err);
      var data = {
        errText: errText
      , css: css
      };
      for (var i = clients.length; i--;) {
        clients[i].channel.send('derby:refreshCss', data);
      }
    });
  });

  files.watch(watchRoot, 'html', function() {
    view._loadTemplates(root, clientName, function(err, templates, instances, libraryData) {
      var errText;
      if (err) errText = templateError(err);
      var data = {
        errText: errText
      , templates: templates
      , instances: instances
      , libraryData: libraryData
      };
      for (var i = clients.length; i--;) {
        clients[i].channel.send('derby:refreshHtml', data);
      }
    });
  });
}
