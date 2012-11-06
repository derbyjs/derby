// Module responsible for managing *[component libraries]*.
//
// [component libraries]: http://derbyjs.com/#component_libraries

var EventEmitter = require('events').EventEmitter
  , path = require('path')
  , merge = require('racer').util.merge
  , View = require('./View')
  , arraySlice = Array.prototype.slice

module.exports = componentPlugin;

// Implemented as a *Racer plugin* which decorates the "derby" object.
function componentPlugin(derby) {
  derby._libraries = [];
  derby._libraries.map = {};
  derby.createLibrary = createLibrary;
}
componentPlugin.decorate = 'derby';

// Prototype chain of a Component instance is as follows:
//
// *   component object (constructed by the `Component` function);
//
//     Adds `this.model` from a constructor's argument.
//
// *   application logic object (exports from a module referenced in `scripts`);
//
//     Adds functions exported from a component's module.
//
// *   `componentProto` object
//
//     Adds `emitCancellable` and `emitDelayable` methods.
//
// *   `EventEmitter`'s prototype object.
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

// Determine component's name based on a context in which it is used. If used
// in the same view, use `lib:*id*`, otherwise use `*ns*:*id*`.
function type(view) {
  return view === this.view ? 'lib:' + this.id : this.ns + ':' + this.id;
}

// ## Creating a component library
//
// Component libraries are created and added to *derby object* by calling
// `createLibrary` on it, passing in a configuration and `options` object.
//
// `config` parameter must be an object containing:
//
// * `filename` of a module
// * optional `ns` defining self-assigned namespace
// * optional `scripts` object for defining components
// * optional `styles` string pointing to the styles file
//
function createLibrary(config, options) {
  if (!config || !config.filename) {
    throw new Error ('Configuration argument with a filename is required');
  }

  // `options` parameter to `createLibrary` is optional. But it is useful when
  // component library must be introduced to an application under a different
  // namespace than that defined by the library themselves (actually it is the
  // only purpose of `options` argument).
  //
  // Usually call to the `createLibrary` occurs from a *Racer plugin* function
  // exported from the *component library* module. This function accepts
  // `options` object and proxy it to the `createLibrary`, thus allowing the
  // application to set a namespace of a component library by providing it via
  // `options.ns` property.
  if (!options) options = {};
  var root = path.dirname(config.filename)
    , ns = options.ns || config.ns || path.basename(root)
    , scripts = config.scripts || {}
    , view = new View
    , constructors = {}
      // Each *component library* is an object which has a namespace `ns`,
      // reference to it's root directory `root` derived from the value of
      // `config.filename`, a separate instance of a View `view`, map of a
      // components `constructors` and a reference to a `styles` file.
    , library = {
        ns: ns
      , root: root
      , view: view
      , constructors: constructors
      , styles: config.styles
      }
    , Component, proto, id;

  // View's `_selfNs` property is set to `lib` (the default is `app`) and
  // `_selfLibrary` -- to the library object itself.
  view._selfNs = 'lib';
  view._selfLibrary = library;

  // Components constructors are created from properties of a `config.scripts`
  // object. Each property in a `scripts` object is an ID (also called name) of
  // a component and it's value will be mixed into a prototype of a Component.
  for (id in scripts) {
    // Component is bound to the model at an object creation step.
    Component = function(model) {
      this.model = model;
    }
    proto = Component.prototype = Object.create(componentProto);
    merge(proto, scripts[id]);
    // Note that this separate instance of a View is shared among all of the
    // components in the library.
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
