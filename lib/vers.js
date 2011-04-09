var dom = exports.dom = require('./dom'),
    model = exports.model = require('./model'),
    view = exports.view = require('./view'),
    _ = exports.utils = require('./utils');

dom._link(model);
model._link(view);
view._link(dom, model);

module.exports = function(clientModule, clientExports) {
  if (_.onServer) {
    clientExports.dom = dom;
    clientExports.model = model;
    clientExports.view = view;

    clientModule.exports = function(app) {
      var io = require('socket.io'),
          browserify = require('browserify'),
          path = require('path'),
          clientDir = path.dirname(clientModule.filename),
          js = browserify({
            base: clientDir,
            staticRoot: path.dirname(clientDir),
            filter: _.minify
          }),
          socket = io.listen(app, {transports: ['websocket', 'xhr-polling'] });
      socket.on('connection', function(client) {      
        client.on('message', function(message) {
          var data = JSON.parse(message),
              method = data[0],
              args = data[1];
          // Don't store or send to other clients if the model path contains a name
          // that starts with an underscore
          if (! /(^_)|(\._)/.test(args[0])) {
            model[method].apply(null, args);
            client.broadcast(message);
          }
        });
      });
      model._setSocket(socket);
      clientExports.socket = socket;

      view._setClientName(path.basename(clientModule.filename, '.js'));
      view._setJsFile(js.filename);
      app.use(js.handle);

      return clientExports;
    };
  } else {
    clientModule.exports = function(count, modelData, modelEvents, domEvents) {
      var io = require('./socket.io'),
          socket = new io.Socket(null);
      socket.connect();
      socket.on('message', function(message) {
        message = JSON.parse(message);
        model['_' + message[0]].apply(null, message[1]);
      });
      model._setSocket(socket);
      
      view.uniqueId._count = count;
      model.init(modelData);
      model.events.set(modelEvents);
      dom.events.set(domEvents);
      return clientExports;
    };
  }

  return exports;
};