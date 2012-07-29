var EventEmitter = require('events').EventEmitter
  , path = require('path')
  , merge = require('racer').util.merge
  , View = require('./View')
  , arraySlice = Array.prototype.slice

module.exports = componentPlugin;

function componentPlugin(derby) {
  derby._libraries = [];
  derby._libraries.map = {};
  derby.createLibrary = createLibrary;
}
componentPlugin.decorate = 'derby';


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
  var root = path.dirname(config.filename)
    , ns = options.ns || config.ns || path.basename(root)
    , scripts = config.scripts || {}
    , view = new View
    , constructors = {}
    , library = {
        ns: ns
      , root: root
      , view: view
      , constructors: constructors
      , styles: config.styles
      }
    , Component, proto, id;

  view._selfNs = 'lib';
  view._selfLibrary = library;

  for (id in scripts) {
    Component = function(model) {
      this.model = model;
    }
    proto = Component.prototype = Object.create(componentProto);
    merge(proto, scripts[id]);
    Component.view = proto.view = view;
    Component.ns = ns;
    Component.id = id;
    Component.type = type;

    // Note that component names are all lowercased
    constructors[id.toLowerCase()] = Component;
  }

  this._libraries.push(library);
  this._libraries.map[ns] = library;
  return library;
}
