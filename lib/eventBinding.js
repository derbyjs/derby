var util = require('racer').util
  , lookup = require('racer/lib/path').lookup
  , merge = util.merge
  , viewPath = require('./viewPath')
  , extractPlaceholder = viewPath.extractPlaceholder
  , dataValue = viewPath.dataValue
  , ctxPath = viewPath.ctxPath
  , pathFnArgs = viewPath.pathFnArgs
  , setBoundFn = viewPath.setBoundFn;

exports.splitEvents = splitEvents;
exports.containsEvent = containsEvent;
exports.addDomEvent = util.isServer ? empty : addDomEvent;

function splitEvents(eventNames) {
  var pairs = eventNames.replace(/\s/g, '').split(',')
    , eventList = []
    , pair, segments, name, eventName, delay, fn;
  for (var i = pairs.length; i--;) {
    pair = pairs[i];
    segments = pair.split(':');
    name = segments[0].split('/');
    eventName = name[0];
    delay = name[1];
    fn = segments[1];
    fn = fn ? extractPlaceholder(fn) || fn : '';
    eventList.push([eventName, delay, fn]);
  }
  return eventList;
}

function containsEvent(eventNames, expected) {
  var eventList = splitEvents(eventNames)
    , eventName;
  for (var i = eventList.length; i--;) {
    eventName = eventList[i][0];
    if (eventName === expected) return true;
  }
  return false;
}

function addDomEvent(events, attrs, eventNames, match, options) {
  var eventList = splitEvents(eventNames)
    , args, name, macro;

  if (match) {
    name = match.name;
    macro = match.macro;

    if (~name.indexOf('(')) {
      args = pathFnArgs(name);
      if (!args.length) return;

      events.push(function(ctx, modelEvents, dom, pathMap, view) {
        var id = attrs._id || attrs.id
          , paths = []
          , arg, path, pathId, event, eventName, eventOptions, i, j;
        options.setValue = function(model, value) {
          return setBoundFn(view, ctx, model, name, value);
        }
        for (i = args.length; i--;) {
          arg = args[i];
          path = ctxPath(ctx, arg, macro);
          paths.push(path);
          pathId = pathMap.id(path);
          for (j = eventList.length; j--;) {
            event = eventList[j];
            eventName = event[0];
            eventOptions = merge({pathId: pathId, delay: event[1]}, options);
            dom.bind(eventName, id, eventOptions);
          }
        }
      });
      return;
    }

    events.push(function(ctx, modelEvents, dom, pathMap) {
      var id = attrs._id || attrs.id
        , pathId = pathMap.id(ctxPath(ctx, name, macro))
        , event, eventName, eventOptions, i;
      for (i = eventList.length; i--;) {
        event = eventList[i];
        eventName = event[0];
        eventOptions = merge({pathId: pathId, delay: event[1]}, options);
        dom.bind(eventName, id, eventOptions);
      }
    });
    return;
  }

  events.push(function(ctx, modelEvents, dom, pathMap, view) {
    var id = attrs._id || attrs.id
      , event, eventName, eventOptions, i;
    for (i = eventList.length; i--;) {
      event = eventList[i];
      eventName = event[0];
      eventOptions = fnListener(view, ctx, dom, event[1], event[2]);
      merge(eventOptions, options);
      dom.bind(eventName, id, eventOptions);
    }
  });
}

function fnListener(view, ctx, dom, delay, fnObj) {
  var listener = {
    delay: delay
  , fn: function() {
      var fnName, fn, fnCtxs, i, fnCtx;

      fnName = typeof fnObj === 'object'
        ? dataValue(view, ctx, view.model, fnObj.name, fnObj.macro)
        : fnName = fnObj;

      // If a placeholder for an event name does not have a value, do nothing
      if (!fnName) return listener.fn = empty;

      // See if it is a built-in function
      fn = dom.fns[fnName];

      // Lookup the function name on the component script or app

      // TODO: This simply looks in the local scope for the function
      // and then goes up the scope if a function name is not found.
      // Better would be to actually figure out the scope of where the
      // function name is specfied, since there could easily be namespace
      // conflicts between functions in a component and functions in an
      // app using that component. How to implement this correctly is not
      // obvious at the moment.
      if (!fn) {
        fnCtxs = ctx.$fnCtx;
        for (i = fnCtxs.length; i--;) {
          fnCtx = fnCtxs[i];
          fn = fnCtx[fnName] || lookup(fnName, fnCtx);
          if (fn) break;
        }
      }
      if (!fn) throw new Error('Bound function not found: ' + fnName);

      // Bind the listener to the app or component object on which it
      // was defined so that the `this` context will be the instance
      listener.fn = fn.bind(fnCtx);
      fn.apply(fnCtx, arguments);
    }
  };
  return listener;
}

function empty() {}
