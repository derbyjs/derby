{lookup} = require 'racer/lib/path'

# Remove leading whitespace and newlines from a string. Note that trailing
# whitespace is not removed in case whitespace is desired between lines
exports.trim = trim = (s) -> if s then s.replace /\n\s*/g, '' else ''

# True if remaining text does not immediately close the current tag
exports.wrapRemainder = (tagName, remainder) ->
  return false unless remainder
  return !(new RegExp '^<\/' + tagName, 'i').test(remainder)

exports.modelPath = modelPath = (ctx, name, noReplace) ->
  name = if name is '.this' then '.' else name.replace(/\.this$/, '')
  firstChar = name.charAt(0)

  if firstChar is ':'
    # Dereference alias name
    if ~(i = name.indexOf '.')
      aliasName = name[1...i]
      name = name[i..]
    else
      aliasName = name.slice 1
      name = ''
    # Calculate depth difference between alias's definition and usage
    i = ctx.$depth - ctx.$aliases[aliasName]
    if i != i  # If NaN
      throw new Error "Can't find alias for #{aliasName}"

  else if firstChar is '.'
    # Dereference relative path
    i = 0
    i++ while name.charAt(i) == '.'
    name = if i == name.length then '' else name.slice i - 1

  if i && (name = ctx.$paths[i - 1] + name) && !noReplace
    # Replace array index placeholders with the proper index
    i = 0
    indices = ctx.$i
    name = name.replace /\$#/g, -> indices[i++]

  # Interpolate the value of names within square brackets
  return name.replace /\[([^\]]+)\]/g, (match, name) -> lookup name, ctx

openPlaceholder = ///^
  ([\s\S]*?)  # Before the placeholder
  (\({2,3}|\{{2,3})  # Opening of placeholder
  ([\s\S]*)  # Remainder
///

placeholderContent = ///^
  \s*([\#/]?)  # Start or end block
  (if|else|elseif|unless|each|with)?  # Block type
  \s*(  # Name of context object
    [^\s(>]*
    (?: \s* \( [\s\S]* \) )?
  )
  (?:\s+as\s+:([^\s>]+))?  # Alias name
  (?:\s*>\s*([^\s]+)\s*)?  # Partial name
///

matchParens = (text, num, i) ->
  i++
  while num
    close = text.indexOf ')', i
    open = text.indexOf '(', i
    hasClose = ~close
    hasOpen = ~open
    if hasClose && (!hasOpen || (close < open))
      i = close + 1
      num--
      continue
    else if hasOpen
      i = open + 1
      num++
      continue
    else
      return
  return i

exports.extractPlaceholder = (text) ->
  return unless match = openPlaceholder.exec text
  pre = match[1]
  open = match[2]
  remainder = match[3]
  bound = open.charAt(0) is '('
  openLen = open.length
  escaped = openLen is 2

  if bound
    return unless end = matchParens remainder, openLen, 0
    endInner = end - openLen

  else
    close = if escaped then '}}' else '}}}'
    return unless ~(endInner = remainder.indexOf close)
    end = endInner + openLen

  inner = remainder[0...endInner]
  post = remainder[end..]
  return unless content = placeholderContent.exec inner    

  return {
    pre: trim pre
    post: trim post
    bound: bound
    escaped: escaped
    hash: content[1]
    type: content[2]
    name: content[3]
    alias: content[4]
    partial: content[5]?.toLowerCase()
  }

fnCall = ///^
  ([^(]+)  # Function name
  \s* \( \s*
  ([\s\S]*?)  # Arguments
  \s* \) \s*
$///
argSeparator = /\s*([,(])\s*/g
notSeparator = /[^,\s]/g

fnCallError = (name) ->
  throw new Error 'malformed view function call: ' + name

fnArgs = (inner) ->
  args = []
  lastIndex = 0
  while match = argSeparator.exec inner
    # Find nested function calls
    if match[1] is '('
      end = matchParens inner, 1, argSeparator.lastIndex
      args.push inner[lastIndex...end]
      notSeparator.lastIndex = end
      lastIndex = argSeparator.lastIndex =
        if notSeparator.test inner then notSeparator.lastIndex - 1 else end
      continue

    # Push an argument
    args.push inner[lastIndex...match.index]
    lastIndex = argSeparator.lastIndex

  # Push the last argument
  if last = inner[lastIndex..]
    args.push last
  return args

fnArgValue = (view, ctx, model, name, arg) ->
  # Support null, true, and false -- the same keyword values as JSON 
  if arg is 'null'
    return null

  if arg is 'true'
    return true

  if arg is 'false'
    return false

  firstChar = arg.charAt 0

  if firstChar is "'"
    fnCallError name unless match = /^'(.*)'$/.exec arg
    return match[1]

  if firstChar is '"'
    fnCallError name unless match = /^"(.*)"$/.exec arg
    return match[1]

  if /^[\d-]/.test firstChar
    # JavaScript's isNaN will be false for any number or string
    # that could be a number, such as '3'. Otherwise, it is true
    fnCallError name if isNaN arg
    # Cast into a number
    return +arg

  if firstChar is '[' || firstChar is '{'
    throw new Error 'object literals not supported in view function call: ' + name

  return dataValue view, ctx, model, arg

fnValue = (view, ctx, model, name) ->
  fnCallError name unless match = fnCall.exec name
  fnName = match[1]
  args = fnArgs match[2]

  # Get values for each argument
  for arg, i in args
    args[i] = fnArgValue view, ctx, model, name, arg

  unless fn = view.getFns[fnName]
    throw new Error 'view function "' + fnName + '" not found for call: ' + name

  return fn args...

notPathArg = ///
  (?:^ ['"\d[{-] )|  # String, number, or object literal
  (?:^ null $)|
  (?:^ true $)|
  (?:^ false $)
///
exports.pathFnArgs = pathFnArgs = (name, paths = []) ->
  fnCallError name unless match = fnCall.exec name
  args = fnArgs match[2]

  for arg in args
    if notPathArg.test arg
      continue
    if ~arg.indexOf('(')
      pathFnArgs arg, paths
      continue
    paths.push arg

  return paths

exports.dataValue = dataValue = (view, ctx, model, name) ->
  if ~name.indexOf('(')
    return fnValue view, ctx, model, name
  path = modelPath ctx, name
  value = lookup path, ctx
  return value if value isnt undefined
  value = model.get path
  return if value isnt undefined then value else model[path]

exports.setBoundFn = (view, ctx, model, name, value) ->
  fnCallError name unless match = fnCall.exec name
  fnName = match[1]
  args = fnArgs match[2]

  unless (get = view.getFns[fnName]) && (set = view.setFns[fnName])
    throw new Error 'view function "' + fnName + '" not found for binding to: ' + name

  # Get each of the input values
  numInputs = set.length - 1
  i = args.length - numInputs
  inputs = [value]
  while arg = args[i++]
    inputs.push fnArgValue view, ctx, model, name, arg

  out = set inputs...

  # Set each of the defined output values
  for value, i in out
    arg = args[i]
    continue if value is undefined || notPathArg.test arg
    path = modelPath ctx, arg
    continue if model.get(path) == value
    model.set path, value
  return
