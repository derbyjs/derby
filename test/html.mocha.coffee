{expect, calls} = require 'racer/test/util'
html = require '../src/html'

describe 'html', ->

  it 'should parse with no handlers', ->
    html.parse '<p id=stuff>Heyo</p>'

  it 'should parse basic HTML', ->
    s =
      '<h1>Willow ' + # Tag containing chars
        '<EM ID=h1 CLASS=head>' + # Nested tag, attributes, uppercase
          'tree' +
        '</em>' +
      '</h1>' +
      '<!-- here is a comment\n lets see it go away-->\n\t  ' +
      '<b><b><b></b></b></b>' + # Nested tags, no contents
      '<form action= \'javascript:alert("cows")\' >' + # Single quote attr
        '<input type = "checkbox" disabled data-stuff=hey>' + # double quotes attr, empty attr, and data attribute
        '<input type="submit" value=>' + # While invalid HTML, value should be an empty string
      '</FORM>' + # Uppercase end
      '<img src=/img/stuff.png alt=""/>' + # Don't choke on XML
      '<p>Flowers ' + # Trailing whitespace on implicitly closed tag
      '<p>Flight</p>\n' + # Explicitly closed tag
      '  \t<p>Fight</p>\t \n' + # New line and leading whitespace
      '<p>Blight\nSight</p> <p / >' # Whitespace between tags
    expected = [
      ['start', 'h1', {}]
      ['chars', 'Willow ']
      ['start', 'em', { id: 'h1', 'class': 'head' }]
      ['chars', 'tree']
      ['end', 'em']
      ['end', 'h1']
      ['chars', '\n\t  ']
      ['start', 'b', {}]
      ['start', 'b', {}]
      ['start', 'b', {}]
      ['end', 'b']
      ['end', 'b']
      ['end', 'b']
      ['start', 'form', {action: 'javascript:alert("cows")'}]
      ['start', 'input', {type: 'checkbox', disabled: null, 'data-stuff': 'hey'}]
      ['start', 'input', {type: 'submit', value: ''}]
      ['end', 'form']
      ['start', 'img', {src: '/img/stuff.png', alt: ''}]
      ['start', 'p', {}]
      ['chars', 'Flowers ']
      ['start', 'p', {}]
      ['chars', 'Flight']
      ['end', 'p']
      ['chars', '\n  \t']
      ['start', 'p', {}]
      ['chars', 'Fight']
      ['end', 'p']
      ['chars', '\t \n']
      ['start', 'p', {}]
      ['chars', 'Blight\nSight']
      ['end', 'p']
      ['chars', ' ']
      ['start', 'p', {}]
    ]

    stack = []
    html.parse s,
      chars: (text) -> stack.push ['chars', text]
      start: (tag, tagName, attrs) -> stack.push ['start', tagName, attrs]
      end: (tag, tagName) -> stack.push ['end', tagName]

    for item, index in expected
      expect(stack[index]).to.eql item
    expect(stack.length).to.equal expected.length
