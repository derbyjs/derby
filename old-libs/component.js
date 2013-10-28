var EventEmitter = require('events').EventEmitter
  , path = require('path')
  , util = require('racer').util
  , View = require('./View')
  , arraySlice = Array.prototype.slice

module.exports = componentPlugin;

function componentPlugin(app) {
  app._libraries = [];
  app._libraries.map = {};
  app.createLibrary = createLibrary;
}

var componentProto = Object.create(EventEmitter.prototype);

componentProto.emitCancellable = function() {
  var cancelled = false
    , args = arraySlice.call(arguments)

  function cancel() {
    cancelled = true;
  }

  args.push(cancel);
  this.emit.apply(this, args);
  return cancelled;
};

componentProto.emitDelayable = function() {
  var delayed = false
    , args = arraySlice.call(arguments, 0, -1)
    , callback = arguments[arguments.length - 1]

  function delay() {
    delayed = true;
  }

  args.push(delay, callback);
  this.emit.apply(this, args);
  if (!delayed) callback();
  return delayed;
};

function type(view) {
  return view === this.view ? 'lib:' + this.id : this.ns + ':' + this.id;
}

function createLibrary(config, options) {
  if (!config || !config.filename) {
    throw new Error ('Configuration argument with a filename is required');
  }
  if (!options) options = {};
  var root = path.dirname(config.filename);
  var ns = options.ns || config.ns || path.basename(root);
  var scripts = config.scripts || {};
  var view = new View;
  var constructors = {};
  var library = {
    ns: ns
  , root: root
  , view: view
  , constructors: constructors
  , styles: config.styles
  };

  view.parent = this;
  view._selfNs = 'lib';
  view._selfLibrary = library;

  for (var id in scripts) {
    var script = scripts[id];
    script.setup && script.setup(library);

    var Component = function(model, scope) {
      this.view = view;
      this.model = model;
      this.scope = scope;
      this.history = null;
      this.dom = null;

      // Don't limit the number of listeners
      this.setMaxListeners(0);

      var component = this;
      model.__on = model._on;
      model._on = function(name, listener) {
        component.on('destroy', function() {
          model.removeListener(name, listener);
        })
        return model.__on(name, listener);
      };
      component.on('destroy', function() {
        model.silent().del();
      });
    }
    var proto = Component.prototype = Object.create(componentProto);
    util.mergeInto(proto, script);

    Component.view = view;
    Component.ns = ns;
    Component.id = id;
    Component.type = type;

    // Note that component names are all lowercased
    constructors[id.toLowerCase()] = Component;
  }

  var replaced = false;
  for (var i = this._libraries.length; i--;) {
    if (this._libraries[i].ns === ns) {
      this._libraries[i] = library;
      replaced = true;
    }
  }
  if (!replaced) {
    this._libraries.push(library);
  }
  this._libraries.map[ns] = library;
  return library;
}
