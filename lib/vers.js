module.exports = function(parentModule, parentExports) {
  var dom = exports.dom = require('./dom'),
      model = exports.model = require('./model'),
      view = exports.view = require('./view'),
      _ = exports.utils = require('./utils');
  
  dom._link(model, view);
  model._link(dom);
  view._link(dom, model);
  
  if (_.onServer) {
    parentExports.dom = dom;
    parentExports.model = model;
    parentExports.view = view;
    
    parentModule.exports = function(app, dbUrl) {
      var browserify = require('browserify'),
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
          db = require('./db')(dbUrl, model, parentExports),
          io = require('socket.io'),
          socket = io.listen(app, {transports: ['websocket', 'xhr-polling'] });
      
      model._setDb(db);
      model._setSocket(socket);
      
      view._setClientName(path.basename(parentModule.filename, '.js'));
      view._setJsFile(js.filename);
      app.use(js.handle);
      
      return parentExports;
    };
    
  } else {
    parentModule.exports = function(count, modelData, modelEvents, domEvents) {
      var io = require('./socket.io'),
          socket = new io.Socket(null);
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