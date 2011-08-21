module.exports = view = require './view'

clientName = ''
jsFile = ''
view._setClientName = (s) -> clientName = s
view._setJsFile = (s) -> jsFile = s

view.html = ->
  model.events._names = {}
  dom.events._names = {}
  uniqueId._count = 0
  title = get('Title')
  head = get('Head')
  body = get('Body')
  foot = get('Foot')
  "<!DOCTYPE html><title>#{title}</title>#{head}#{body}" +
  '<script>function $(s){return document.getElementById(s)}' +
  _.minify(loadFuncs, true) + '</script>' +
  "<script src=#{jsFile}></script>" +
  "<script>var #{clientName}=require('./#{clientName}')(" + uniqueId._count +
  ',' + JSON.stringify(model.get()).replace(/<\//g, '<\\/') +
  ',' + JSON.stringify(model.events.get()) +
  ',' + JSON.stringify(dom.events.get()) + ");</script>#{foot}"