empty = ->
EventDispatcher = module.exports = (options = {}) ->
  @_onTrigger = options.onTrigger || empty
  @_onBind = options.onBind || empty
  @clear()
  return

EventDispatcher:: =
  clear: ->
    @_names = {}

  bind: (name, listener, arg0) ->
    @_onBind name, listener, arg0
    names = @_names
    obj = names[name] || {}
    obj[JSON.stringify listener] = listener
    names[name] = obj

  trigger: (name, value, arg0, arg1, arg2, arg3) ->
    names = @_names
    listeners = names[name]
    onTrigger = @_onTrigger
    count = 0
    for key, listener of listeners
      count++
      continue unless false == onTrigger name, listener, value, arg0, arg1, arg2, arg3
      delete listeners[key]
      count--
    delete names[name]  unless count
    return count
