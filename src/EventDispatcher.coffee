{hasKeys} = require('racer').util

swapQuotes = (s) -> s.replace /['"]/g,
  (match) -> if match == '"' then "'" else '"'

EventDispatcher = module.exports = (options = {}) ->
  empty = ->
  @_onTrigger = options.onTrigger || empty
  @_onBind = options.onBind || empty
  @_onUnbind = options.onUnbind || empty
  @_names = {}
  return

EventDispatcher:: = 
  bind: (name, listener) ->
    return  if @_onBind(name, listener) == false
    names = @_names
    key = if `listener == null` then 'null' else JSON.stringify listener
    obj = names[name] || {}
    obj[key] = true
    names[name] = obj
  
  unbind: (name, listener) ->
    return  if @_onUnbind(name, listener) == false
    names = @_names
    return unless obj = names[name]
    delete obj[JSON.stringify listener]
    delete names[name]  unless hasKeys obj
  
  trigger: (name, value, arg0, arg1) ->
    names = @_names
    listeners = names[name]
    onTrigger = @_onTrigger
    count = 0
    for key of listeners
      count++
      listener = JSON.parse key
      continue unless onTrigger(name, listener, value, arg0, arg1) == false
      delete listeners[key]
      count--
    delete names[name]  if count == 0
  
  get: ->
    # Get all listener data in more compact array format
    names = @_names
    out = {}
    for name, listeners of names
      out[name] = (swapQuotes listener for listener of listeners)
    return out
  
  set: (n) ->
    # Load in data in array format previously output by get
    names = @_names
    for name, listeners of n
      obj = names[name] = {}
      for listener in listeners
        obj[swapQuotes listener] = true

  clear: ->
    @_names = {}
