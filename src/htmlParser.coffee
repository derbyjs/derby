startTag = /^<(\w+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)?)?)*)\s*(\/?)>/
endTag = /^<\/(\w+)[^>]*>/
attr = /(\w+)(?:\s*(=)\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+))?)?/g
comment = /<!--[\s\S]*?-->(?:\n\s*)?/g
endingSpace = /\n\s*$/

exports.parse = (html, handler) ->

  parseStartTag = (tag, tagName, rest) ->
    attrs = {}
    rest.replace attr, (match, name, equals, attr0, attr1, attr2) ->
      attrs[name.toLowerCase()] = attr0 || attr1 || attr2 || (if equals then '' else null)
    startHandler tagName.toLowerCase(), attrs

  parseEndTag = (tag, tagName) ->
    endHandler tagName.toLowerCase()

  empty = ->
  charsHandler = (handler && handler.chars) || empty
  startHandler = (handler && handler.start) || empty
  endHandler = (handler && handler.end) || empty

  html = html.replace comment, ''

  while html
    last = html
    chars = true

    if html[0] == '<'
      if html[1] == '/'
        match = html.match endTag
        if match
          html = html.substring match[0].length
          match[0].replace endTag, parseEndTag
          chars = false
      else
        match = html.match startTag
        if match
          html = html.substring match[0].length
          match[0].replace startTag, parseStartTag
          chars = false

    if chars
      index = html.indexOf '<'
      text = if index < 0 then html else html.substring 0, index
      html = if index < 0 then '' else html.substring index
      text = text.replace endingSpace, ''
      charsHandler text  if text

    throw 'Parse error: ' + html  if html == last
