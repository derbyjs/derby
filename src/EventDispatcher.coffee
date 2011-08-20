swapQuotes = (s) ->
  s.replace /['"]/g, (match) ->
    (if match == "\"" then "'" else "\"")
_ = require("./utils")
EventDispatcher = module.exports = (onTrigger, onBind, onUnbind) ->
  empty = ->
  
  @_onTrigger = onTrigger or empty
  @_onBind = onBind or empty
  @_onUnbind = onUnbind or empty
  @trigger = (if _.onServer then empty else @_trigger)
  @_names = {}

EventDispatcher:: = 
  bind: (name, listener) ->
    return  if @_onBind(name, listener) == false
    names = @_names
    key = (if _.isDefined(listener) then JSON.stringify(listener) else "null")
    obj = names[name] or {}
    obj[key] = true
    names[name] = obj
  
  unbind: (name, listener) ->
    return  if @_onUnbind(name, listener) == false
    names = @_names
    obj = names[name]
    key = JSON.stringify(listener)
    if obj
      delete obj[key]  if obj[key]
      delete names[name]  unless Object.keys(obj).length
  
  _trigger: (name, value, options) ->
    names = @_names
    listeners = names[name]
    onTrigger = @_onTrigger
    i = 0
    deleted = 0
    for key of listeners
      i++
      listener = JSON.parse(key)
      if onTrigger(name, listener, value, options) == false
        delete listeners[key]
        
        deleted++
    delete names[name]  if i - deleted == 0
  
  get: ->
    names = @_names
    out = {}
    Object.keys(names).forEach (name) ->
      out[name] = Object.keys(names[name]).map(swapQuotes)
    
    out
  
  set: (n) ->
    names = @_names
    Object.keys(n).forEach (name) ->
      obj = names[name] = {}
      listeners = n[name]
      listeners.forEach (listener) ->
        obj[swapQuotes(listener)] = true
