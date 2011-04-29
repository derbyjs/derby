var wrapTest = require('./helpers').wrapTest,
    assert = require('assert'),
    htmlParser = require('../lib/htmlParser.js');

module.exports = {
  'test htmlParser basic HTML': function() {
    var stack = [],
        handlers = {
          chars: function(text) {
            stack.push(['chars', text]);
          },
          start: function(tagName, attrs) {
            stack.push(['start', tagName, attrs]);
          },
          end: function(tagName) {
            stack.push(['end', tagName]);
          }
        },
        html, expected;
    html =
      '<h1>Willow ' + // Tag containing chars
        '<EM ID=h1 CLASS=head>' + // Nested tag, attributes, uppercase
          'tree' +
        '</em>' +
      '</h1>' +
      '<!-- here is a comment\n lets see it go away-->\n\t  ' +
      '<b><b><b></b></b></b>' + // Nested tags, no contents
      '<form action= \'javascript:alert("cows")\' >' + // Single quote attr
        '<input type = "checkbox" disabled>' + // double quotes attr and empty attr
        '<input type="submit" value=>' + // While invalid HTML, value should be an empty string
      '</FORM>' + // Uppercase end
      '<img src=/img/stuff.png alt=""/>' + // Don't choke on XML
      '<p>Flowers ' + // Trailing whitespace on implicitly closed tag
      '<p>Flight</p>\n' + // Explicitly closed tag
      '  \t<p>Fight</p>\t \n' + // New line and leading whitespace between tags should disappear
      '<p>Blight</p> <p>'; // Trailing whitespace and between tags should be kept
    expected = [
      ['start', 'h1', {}],
      ['chars', 'Willow '],
      ['start', 'em', { id: 'h1', 'class': 'head' }],
      ['chars', 'tree'],
      ['end', 'em'],
      ['end', 'h1'],
      ['start', 'b', {}],
      ['start', 'b', {}],
      ['start', 'b', {}],
      ['end', 'b'],
      ['end', 'b'],
      ['end', 'b'],
      ['start', 'form', { action: 'javascript:alert("cows")'}],
      ['start', 'input', { type: 'checkbox', disabled: null }],
      ['start', 'input', { type: 'submit', value: '' }],
      ['end', 'form'],
      ['start', 'img', { src: '/img/stuff.png', alt: '' }],
      ['start', 'p', {}],
      ['chars', 'Flowers '],
      ['start', 'p', {}],
      ['chars', 'Flight'],
      ['end', 'p'],
      ['start', 'p', {}],
      ['chars', 'Fight'],
      ['end', 'p'],
      ['chars', '\t '],
      ['start', 'p', {}],
      ['chars', 'Blight'],
      ['end', 'p'],
      ['chars', ' '],
      ['start', 'p', {}]
    ];
    htmlParser.parse(html, handlers);
    expected.forEach(function(item, index) {
      stack[index].should.eql(item);
    });
    stack.length.should.equal(expected.length);
  }
}