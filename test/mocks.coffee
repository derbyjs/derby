{Model} = require('racer').protected

DetachedModel = exports.DetachedModel = ->
  Model.apply this, arguments
  return
DetachedModel:: =
  __proto__: Model::
  _commit: ->

ResMock = exports.ResMock = ->
  @html = ''
  return
ResMock:: =
  getHeader: ->
  setHeader: ->
  write: write = (value) ->
    @html += value
  send: write
  end: (value) ->
    write value
    @onEnd? @html
