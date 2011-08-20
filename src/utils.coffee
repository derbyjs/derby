isArray = exports.isArray = Array.isArray or (obj) ->
  toString.call(obj) == "[object Array]"

isArguments = exports.isArguments = (obj) ->
  not not (obj and hasOwnProperty.call(obj, "callee"))

exports.isFunction = (obj) ->
  not not (obj and obj.constructor and obj.call and obj.apply)

exports.isString = (obj) ->
  not not (obj == "" or (obj and obj.charCodeAt and obj.substr))

exports.isNumber = (obj) ->
  not not (obj == 0 or (obj and obj.toExponential and obj.toFixed))

exports.isNaN = (obj) ->
  obj != obj

exports.isBoolean = (obj) ->
  obj == true or obj == false

exports.isDate = (obj) ->
  not not (obj and obj.getTimezoneOffset and obj.setUTCFullYear)

exports.isRegExp = (obj) ->
  not not (obj and obj.test and obj.exec and (obj.ignoreCase or obj.ignoreCase == false))

exports.isNull = (obj) ->
  obj == null

exports.isUndefined = (obj) ->
  obj == undefined

exports.isDefined = (obj) ->
  obj != undefined

exports.toArray = (iterable) ->
  return []  unless iterable
  return iterable.toArray()  if iterable.toArray
  return Array.slice.call(iterable)  if isArguments(iterable)
  return iterable  if isArray(iterable)
  forEach iterable, (key, value) ->
    value

exports.toNumber = (obj) ->
  obj - 0

exports.arrayMax = (array) ->
  Math.max.apply Math, array

exports.arrayMin = (array) ->
  Math.min.apply Math, array

exports.onServer = typeof window == "undefined"
exports.publicModel = (name) ->
  not /(^_)|(\._)/.test(name)

forEach = exports.forEach = (obj, iterator) ->
  for key of obj
    iterator key, obj[key]

_ = exports
if _.onServer
  exports.minify = (->
    store = {}
    uglify = require("uglify-js")
    (js, cache) ->
      return store[js]  if cache and store[js]
      js = js.replace(/_\.onServer/g, "false")
      ufuncs = uglify.uglify
      out = uglify.parser.parse(js)
      out = ufuncs.ast_mangle(out)
      out = ufuncs.ast_squeeze(out)
      out = ufuncs.gen_code(out)
      store[js] = out  if cache
      out
  )()
else
