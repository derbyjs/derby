var util = require('racer').util
  , viewPath = require('./viewPath')
  , extractPlaceholder = viewPath.extractPlaceholder
  , dataValue = viewPath.dataValue
  , ctxPath = viewPath.ctxPath
  , pathFnArgs = viewPath.pathFnArgs
  , setBoundFn = viewPath.setBoundFn
  , arraySlice = [].slice

exports.splitEvents = splitEvents;
exports.fnListener = fnListener;
exports.containsEvent = containsEvent;
exports.addDomEvent = util.isServer ? empty : addDomEvent;

function splitEvents(eventNames) {
  var pairs = eventNames.split(',')
    , eventList = []
    , i, j, pair, segments, name, eventName, delay, fns, fn;
  for (i = pairs.length; i--;) {
    pair = pairs[i];
    segments = pair.split(':');
    name = segments[0].split('/');
    eventName = name[0].trim();
    delay = name[1];
    fns = (segments[1] || '').trim().split(/\s+/);
    for (j = fns.length; j--;) {
      fn = fns[j];
      fns[j] = extractPlaceholder(fn) || fn;
    }
    eventList.push([eventName, delay, fns]);
  }
  return eventList;
}

function containsEvent(eventNames, expected) {
  if (!Array.isArray(expected)) expected = [expected];
  var eventList = splitEvents(eventNames)
    , i, j, eventName
  for (i = eventList.length; i--;) {
    eventName = eventList[i][0];
    for (j = expected.length; j--;) {
      if (eventName === expected[j]) return true;
    }
  }
  return false;
}

function addDomEvent(events, attrs, eventNames, match, options) {
  var eventList = splitEvents(eventNames)
    , args, name;

  if (match) {
    name = match.name;

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
          path = ctxPath(view, ctx, arg);
          paths.push(path);
          pathId = pathMap.id(path);
          for (j = eventList.length; j--;) {
            event = eventList[j];
            eventName = event[0];
            eventOptions = util.mergeInto({view: view, ctx: ctx, pathId: pathId, delay: event[1]}, options);
            dom.bind(eventName, id, eventOptions);
          }
        }
      });
      return;
    }

    events.push(function(ctx, modelEvents, dom, pathMap, view) {
      var id = attrs._id || attrs.id
        , pathId = pathMap.id(ctxPath(view, ctx, name))
        , event, eventName, eventOptions, i;
      for (i = eventList.length; i--;) {
        event = eventList[i];
        eventName = event[0];
        eventOptions = util.mergeInto({view: view, ctx: ctx, pathId: pathId, delay: event[1]}, options);
        dom.bind(eventName, id, eventOptions);
      }
    });
    return;
  }

  events.push(function(ctx, modelEvents, dom, pathMap, view) {
    var id = attrs._id || attrs.id
      , pathId = pathMap.id(ctxPath(view, ctx, '.'))
      , event, eventName, eventOptions, i;
    for (i = eventList.length; i--;) {
      event = eventList[i];
      eventName = event[0];
      eventOptions = fnListener(view, ctx, event[2], dom);
      eventOptions.delay = event[1];
      util.mergeInto(eventOptions, options);
      util.mergeInto(eventOptions, {view: view, ctx: ctx, pathId: pathId});
      dom.bind(eventName, id, eventOptions);
    }
  });
}

function eachFnListener(view, ctx, fnObj, dom) {
  var fnName, fn, fnCtxs, i, fnCtx;

  fnName = typeof fnObj === 'object'
    ? dataValue(view, ctx, view.model, fnObj.name)
    : fnName = fnObj;

  // If a placeholder for an event name does not have a value, do nothing
  if (!fnName) return empty;

  // See if it is a built-in function
  fn = dom && dom.fns[fnName];

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
      fn = fnCtx[fnName] || viewPath.lookup(fnName, fnCtx);
      if (fn) break;
    }
  }
  if (!fn) throw new Error('Bound function not found: ' + fnName);

  // Bind the listener to the app or component object on which it
  // was defined so that the `this` context will be the instance
  return fn.bind(fnCtx);
}

function fnListener(view, ctx, fnNames, dom) {
  var listener = {
    fn: function() {
      var len = fnNames.length
        , args = arraySlice.call(arguments)
        , i, fn, boundFns

      if (len === 0) {
        // Don't do anything if no handler functions were specified
        return listener.fn = empty;

      } else if (len === 1) {
        fn = eachFnListener(view, ctx, fnNames[0], dom);

      } else {
        boundFns = [];
        for (i = len; i--;) {
          boundFns.push(eachFnListener(view, ctx, fnNames[i], dom));
        }
        fn = function() {
          var args = arraySlice.call(arguments)
          for (var i = boundFns.length; i--;) {
            boundFns[i].apply(null, args);
          }
        }
      }

      listener.fn = fn;
      fn.apply(null, args);
    }
  };
  return listener;
}

function empty() {}
