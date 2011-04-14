var dom = exports.dom = require('./dom'),
    model = exports.model = require('./model'),
    view = exports.view = require('./view'),
    _ = exports.utils = require('./utils');

dom._link(model);
model._link(view);
view._link(dom, model);

module.exports = function(parentModule, parentExports) {
  if (_.onServer) {
    
    // The model proxy wraps the model for the server, so that when the server
    // performs functions that update the model, the broadcast flag is added
    var modelProxy = Object.create(model);
    ['set', 'push'].forEach(function(item) {
      modelProxy[item] = function(path, value) {
        model[item](path, value, _.publicModel(path));
      };
    });
    
    parentExports.dom = dom;
    parentExports.model = modelProxy;
    parentExports.view = view;
    
    parentModule.exports = function(app, dbUrl) {
      var io = require('socket.io'),
          db = require('./db')(dbUrl, model, parentExports),
          browserify = require('browserify'),
          path = require('path'),
          clientDir = path.dirname(parentModule.filename),
          js = browserify({
            staticRoot: path.dirname(clientDir),
            base: clientDir,
            coffee: false,
            builtins: false,
            require: ['vers'],
            filter: _.minify
          }),
          socket = io.listen(app, {transports: ['websocket', 'xhr-polling'] });
      socket.on('connection', function(client) {      
        client.on('message', function(message) {
          var data = JSON.parse(message),
              method = data[0],
              args = data[1];
          // Don't store or send to other clients if the model path contains
          // a name that starts with an underscore
          if (_.publicModel(args[0])) {
            model[method].apply(null, args);
            client.broadcast(message);
            
            db.message(method, args);
          }
        });
      });
      
      model._setSocket(socket);
      model._setDb(db);
      
      view._setClientName(path.basename(parentModule.filename, '.js'));
      view._setJsFile(js.filename);
      app.use(js.handle);
      
      return parentExports;
    };
    
  } else {
    parentModule.exports = function(count, modelData, modelEvents, domEvents) {
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
      
      return parentExports;
    };
  }

  return exports;
};