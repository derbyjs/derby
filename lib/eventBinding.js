var util = require('racer').util
  , lookup = require('racer/lib/path').lookup
  , merge = util.merge
  , viewPath = require('./viewPath')
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
    fn = segments[1] || '';
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

function addDomEvent(events, attrs, eventNames, name, options) {
  var eventList = splitEvents(eventNames)
    , args;
  if (name) {
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
          path = ctxPath(ctx, arg);
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
        , pathId = pathMap.id(ctxPath(ctx, name))
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
      , fnCtx = ctx.$fnCtx || view._appExports
      , event, eventName, eventOptions, i, fnName;
    for (i = eventList.length; i--;) {
      event = eventList[i];
      eventName = event[0];
      eventOptions = fnListener(dom, fnCtx, event[1], event[2]);
      merge(eventOptions, options);
      dom.bind(eventName, id, eventOptions);
    }
  });
}

function fnListener(dom, fnCtx, delay, fnName) {
  var listener = {
    delay: delay
  , fn: function() {
      listener.fn = dom.fns[fnName] || fnCtx[fnName] || lookup(fnName, fnCtx);
      listener.fn.apply(null, arguments);
    }
  };
  return listener;
}

function empty() {}
