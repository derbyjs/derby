EventDispatcher = module.exports = (options = {}) ->
  @_onTrigger = options.onTrigger || ->
  @_onBind = options.onBind || (name) -> name
  @clear()
  return

EventDispatcher:: =
  clear: ->
    @_names = {}

  bind: (name, listener) ->
    name = @_onBind name, listener
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
    delete names[name]  unless count
