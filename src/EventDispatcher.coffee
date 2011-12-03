EventDispatcher = module.exports = (options = {}) ->
  empty = ->
  @_onTrigger = options.onTrigger || empty
  @_onBind = options.onBind || empty
  @_names = {}
  return

EventDispatcher:: = 
  bind: (name, listener) ->
    @_onBind name, listener
    names = @_names
    obj = names[name] || {}
    obj[JSON.stringify listener] = listener
    names[name] = obj
  
  trigger: (name, value, arg0, arg1, arg2) ->
    names = @_names
    listeners = names[name]
    onTrigger = @_onTrigger
    count = 0
    for key, listener of listeners
      count++
      continue unless onTrigger(name, listener, value, arg0, arg1, arg2) == false
      delete listeners[key]
      count--
    delete names[name]  if count == 0

  clear: ->
    @_names = {}
