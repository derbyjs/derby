startTag = /^<([^\s=\/>]+)((?:\s+[^\s=\/>]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)?)?)*)\s*(\/?)\s*>/
endTag = /^<\/([^\s=\/>]+)[^>]*>/
attr = /([^\s=]+)(?:\s*(=)\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+))?)?/g
literalTag = /^(?:[^:]+:|style|script)$/i
literalEnd = (tagName) -> switch tagName.toLowerCase()
  when 'style' then /<\/style/i
  when 'script' then /<\/script/i
  else /<\/?[^\s=\/>:]+:/
comment = /<!--[\s\S]*?-->/g
exports.uncomment = uncomment = (html) -> html.replace comment, ''

empty = ->
exports.parse = (html, handler = {}) ->
  charsHandler = handler.chars || empty
  startHandler = handler.start || empty
  endHandler = handler.end || empty

  parseStartTag = (tag, tagName, rest) ->
    attrs = {}
    rest.replace attr, (match, name, equals, attr0, attr1, attr2) ->
      attrs[name.toLowerCase()] = attr0 || attr1 || attr2 || (if equals then '' else null)
    startHandler tag, tagName.toLowerCase(), attrs

  parseEndTag = (tag, tagName) ->
    endHandler tag, tagName.toLowerCase()

  onChars = (html, index, literal) ->
    if ~index
      text = html.substring 0, index
      html = html.substring index
    else
      text = html
      html = ''
    charsHandler text, literal  if text
    return html

  # Remove HTML comments before parsing
  html = uncomment html

  while html
    last = html
    chars = true

    if html[0] == '<'
      if html[1] == '/'
        if match = html.match endTag
          html = html.substring match[0].length
          match[0].replace endTag, parseEndTag
          chars = false
      else
        if match = html.match startTag
          html = html.substring match[0].length
          match[0].replace startTag, parseStartTag
          chars = false
          if literalTag.test tagName = match[1]
            index = html.search literalEnd tagName
            html = onChars html, index, true

    if chars
      index = html.indexOf '<'
      html = onChars html, index

    throw 'HTML parse error: ' + html  if html == last
