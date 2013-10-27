{expect, calls} = require 'racer/test/util'
{DetachedModel: Model, ResMock} = require './mocks'
View = require '../lib/View.server'

describe 'View.render', ->

  it 'supports view.render with no defined views', ->
    view = new View
    res = new ResMock
    res.onEnd = (html) ->
      expect(html).to.match /^<!DOCTYPE html><meta charset=utf-8><title>.*<\/title><script>.*<\/script><script.*><\/script>$/
    view.render res

describe 'View', ->
  view = model = null

  beforeEach (done) ->
    view = new View
    model = new Model
    view._init model, false, done

  it 'supports rendering a string literal view', ->
    view.make 'test', """
      <style>
        body {
          margin: 
            0
        }
      </style>
      """
    # String views should have line breaks and leading whitespace removed
    expect(view.get 'test').to.eql '<style>body {margin: 0}</style>'

  it 'doctypes and conditional comments are maintained', ->
    view.make 'test', """
      <!DOCTYPE html>
      <!-- This comment is removed -->
      <title></title>
      <!--[if gt IE 6]>
      IE greater than 6
      <![endif]-->
      <!--[if !IE]> -->
      Not IE
      <!-- <![endif]-->
      """
    expect(view.get 'test').to.eql '<!DOCTYPE html>' +
      '<title></title>' +
      '<!--[if gt IE 6]>\n' +
      'IE greater than 6\n' +
      '<![endif]-->' +
      '<!--[if !IE]> -->Not IE<!-- <![endif]-->'

  it 'supports substituting variables into text', ->
    view.make 'test', '''
      {{connected}}{{canConnect}} {{nada}}
      <p>
        {{name}}
      </p>
      <p>
        {{age}} - {{height}} - {{weight}}
      </p>
      '''
    ctx =
      connected: false
      weight: '165 lbs'
      nada: null

    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'height', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    expected = 'falsetrue ' +
      '<p>John</p>' +
      '<p>22 - 6 ft 2 in - 165 lbs</p>'

    expect(view.get 'test', ctx).to.equal expected

  it 'supports path interpolation', ->
    view.make 'test', """
      {{items[id]}}
      {{#each ids}}
        {{items[this]}}
      {{/}}
      {{#each others}}
        {{items[.id]}}
      {{/}}
      """
    model.set 'id', 2
    model.set 'ids', [2, 0]
    ctx =
      items:
        0: 'red'
        1: 'green'
        2: 'blue'
      others: [
        {id: 1}
        {id: 2}
      ]

    expect(view.get 'test', ctx).to.equal 'blue' +
      'blue' + 'red' +
      'green' + 'blue'

  it 'supports binding variables in text', ->
    view.make 'test', '''
      {connected}{canConnect} {nada}
      <p>
        {name}
      </p>
      <p>
        {age} - {height} - {weight}
      </p>
      '''
    ctx =
      connected: false
      weight: '165 lbs'
      nada: null

    model.set 'name', 'John'
    model.set 'age', 22
    model.set 'height', '6 ft 2 in'
    model.set 'weight', '175 lbs'

    expect(view.get 'test', ctx).to.equal '<!--$0-->false<!--$$0--><!--$1-->true<!--$$1--> <!--$2--><!--$$2-->' +
      '<p id=$3>John</p>' +
      '<p><!--$4-->22<!--$$4--> - <!--$5-->6 ft 2 in<!--$$5--> - <!--$6-->165 lbs<!--$$6--></p>'

  it 'supports HTML escaping', ->
    # Attribute values are escaped regardless of placeholder type
    # Ampersands are escaped at the end of a replacement even when not
    # required, because it is sometimes needed depending on the following item
    template = '''<input value="{unescaped html}"> {html}x{unescaped html}'''
    value = '<b id="hey">&Hi! & x& </b>&'
    expected =
      '<input id=$0 value="<b id=&quot;hey&quot;>&amp;Hi! & x& </b>&amp;"> ' +
      '<!--$1-->&lt;b id="hey">&amp;Hi! & x& &lt;/b>&amp;<!--$$1-->x' +
      '<!--$2--><b id="hey">&Hi! & x& </b>&<!--$$2-->'

    view.make 'test1', template
    expect(view.get 'test1', html: value).to.eql expected

    view._idCount = 0
    model.set 'html', value
    expect(view.get 'test1').to.eql expected

    view.make 'test2',
      '<p a={{a}} b={{b}} c={{c}} d={{d}} e={{e}} f={{f}} g={{g}} h={{h}} i>'
    expect(view.get 'test2',
      {a: '"', b: "'", c: '<', d: '>', e: '=', f: ' ', g: '', h: null}
    ).to.eql '<p a=&quot; b="\'" c="<" d=">" e="=" f=" " g="" h="" i>'

  it 'supports HTML entity unescaping in string partials', ->
    view.make 'title', '{{unescaped name}} - stuff'
    ctx = name: 'Cr&egrave;me Br&ucirc;l&eacute;e'
    expect(view.get 'title$s', ctx).to.eql 'Crème Brûlée - stuff'

  it 'supports conditional blocks in text', ->
    view.make 'literal',
      '{{#if show}}Yep{{else}}Nope{{/}}{{#if show}} Yes!{{/}} {{#unless show}}No{{/}}'
    view.make 'bound',
      '{#if show}Yep{else}Nope{/}{#if show} Yes!{/} {#unless show}No{/}'

    literalTruthy = 'Yep Yes! '
    literalFalsey = 'Nope No'
    modelTruthy = '<!--$0-->Yep<!--$$0--><!--$1--> Yes!<!--$$1--> <!--$2--><!--$$2-->'
    modelFalsey = '<!--$0-->Nope<!--$$0--><!--$1--><!--$$1--> <!--$2-->No<!--$$2-->'

    expect(view.get 'literal', show: true).to.eql literalTruthy
    expect(view.get 'literal', show: 1).to.eql literalTruthy
    expect(view.get 'literal', show: 'x').to.eql literalTruthy
    expect(view.get 'literal', show: {}).to.eql literalTruthy
    expect(view.get 'literal', show: [1]).to.eql literalTruthy

    expect(view.get 'literal', show: false).to.eql literalFalsey
    expect(view.get 'literal', show: undefined).to.eql literalFalsey
    expect(view.get 'literal', show: null).to.eql literalFalsey
    expect(view.get 'literal', show: 0).to.eql literalFalsey
    expect(view.get 'literal', show: '').to.eql literalFalsey
    expect(view.get 'literal', show: []).to.eql literalFalsey
    expect(view.get 'literal').to.eql literalFalsey

    # No parameter assumes it is a model path that is undefined
    view._idCount = 0
    expect(view.get 'bound').to.eql modelFalsey

    view._idCount = 0
    model.set 'show', true
    expect(view.get 'bound').to.eql modelTruthy
    view._idCount = 0
    model.set 'show', 1
    expect(view.get 'bound').to.eql modelTruthy
    view._idCount = 0
    model.set 'show', 'x'
    expect(view.get 'bound').to.eql modelTruthy
    view._idCount = 0
    model.set 'show', {}
    expect(view.get 'bound').to.eql modelTruthy

    view._idCount = 0
    model.set 'show', false
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', undefined
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', null
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', 0
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', ''
    expect(view.get 'bound').to.eql modelFalsey
    view._idCount = 0
    model.set 'show', []
    expect(view.get 'bound').to.eql modelFalsey

  it 'supports else if conditionals', ->
    view.make 'test', """
    {{#if equal('red', value)}}
      1
    {{else if equal('red', value)}}
      2
    {{else if equal('green', value)}}
      3
    {{else}}
      4
    {{/}}
    """

    expect(view.get 'test', value: 'red').to.equal '1'
    expect(view.get 'test', value: 'green').to.equal '3'
    expect(view.get 'test', value: 'blue').to.equal '4'
    expect(view.get 'test').to.equal '4'

  it 'supports unless then else conditionals', ->
    view.make 'test', """
    {{#unless value}}
      1
    {{else}}
      2
    {{/}}
    """

    expect(view.get 'test', value: true).to.equal '2'
    expect(view.get 'test', value: false).to.equal '1'

  it 'supports lists in text', ->
    template = """
    <ul>
    {{#each arr}}
      <li>{{name}}
    {{else}}
      <li>Nothing to see
    {{/}}
    </ul>
    """

    view.make 'test', template
    expect(view.get 'test', arr: [])
      .to.eql '<ul><li>Nothing to see</ul>'

    view.make 'test', template
    expect(view.get 'test', arr: [{name: 'stuff'}, {name: 'more'}])
      .to.eql '<ul><li>stuff<li>more</ul>'

  it 'supports nesting lists with relative paths', ->
    template = """
      <table>
        <tbody>
          {{#each table.rows}}
            <tr>
              {{#each .cells}}
                <td><input value={{.text}}></td>
              {{/}}
            </tr>
          {{/}}
        </tbody>
      </table>
    """

    model.set 'table.rows', [
      {cells: [{text: 'A'}, {text: 'B'}, {text: 'C'}]}
      {cells: [{text: 1}, {text: 2}, {text: 3}]}
    ]

    view.make 'test', template
    expect(view.get 'test').to.equal [
      '<table>'
        '<tbody>'
          '<tr>'
            '<td><input value=A></td>'
            '<td><input value=B></td>'
            '<td><input value=C></td>'
          '</tr>'
          '<tr>'
            '<td><input value=1></td>'
            '<td><input value=2></td>'
            '<td><input value=3></td>'
          '</tr>'
        '</tbody>'
      '</table>'
    ].join('')

  it 'supports nesting aliases to flat lists', ->
    template = """
    {{#each outer as :out}}
      {{#each inner as :in}}
        {{#each core as :core}}
        [{{:out.name}} {{:in.name}} {{:core.name}} {{equal(:out.color, :in.color)}}]
        {{/}}
      {{/}}
    {{/}}
    """

    view.make 'test', template
    compiled = view.get 'test',
      outer: [{name: 'stuff', color: 'blue'}, {name: 'more', color: 'pink'}]
      inner: [{name: '0', color: 'pink'}, {name: '1', color: 'blue'}]
      core: [{name: '0'}, {name: '1'}]
    expect(compiled).to.equal [
      '[stuff 0 0 false]'
      '[stuff 0 1 false]'
      '[stuff 1 0 true]'
      '[stuff 1 1 true]'
      '[more 0 0 true]'
      '[more 0 1 true]'
      '[more 1 0 false]'
      '[more 1 1 false]'
    ].join('')

  it 'supports aliases from relative paths on nested lists', ->
    template = """
    <ul>
      {{#each _room.street}}
        <li>Type: {{.type}}
          {{#each .people as :person}}
            {{#if :person.editable}}
              <input value={{:person.name}}>
            {{else}}
              {{:person.name}}
            {{/}}
          {{/}}
        </li>
      {{/}}
    </ul>
    """

    model.set '_room.street', [
      {
        type: 'home'
        people: [
          {name: 'fred',  editable: true} 
          {name: 'wilma', editable: false}
        ]
      }, {
        type: 'neighbor'
        people: [
          {name: 'barney', editable: false}
          {name: 'betty',  editable: true}
        ]
      }
    ]

    view.make 'test', template
    expect(view.get 'test').to.equal [
      '<ul>'
        '<li>Type: home'
          '<input value=fred>'
          'wilma'
        '</li>'
        '<li>Type: neighbor'
          'barney'
          '<input value=betty>'
        '</li>'
      '</ul>'
    ].join('')

  it 'supports aliases from aliases on nested lists', ->
    template = """
    <ul>
      {{#each _room.street as :street}}
        <li>Type: {{:street.type}}
          {{#each :street.people as :person}}
            {{#if :person.editable}}
              <input value={{:person.name}}>
            {{else}}
              {{:person.name}}
            {{/}}
          {{/}}
        </li>
      {{/}}
    </ul>
    """

    model.set '_room.street', [
      {
        type: 'home'
        people: [
          {name: 'fred',  editable: true} 
          {name: 'wilma', editable: false}
        ]
      }, {
        type: 'neighbor'
        people: [
          {name: 'barney', editable: false}
          {name: 'betty',  editable: true}
        ]
      }
    ]

    view.make 'test', template
    expect(view.get 'test').to.equal [
      '<ul>'
        '<li>Type: home'
          '<input value=fred>'
          'wilma'
        '</li>'
        '<li>Type: neighbor'
          'barney'
          '<input value=betty>'
        '</li>'
      '</ul>'
    ].join('')

  it 'supports boolean attributes', ->
    view.make 'test', '<input disabled={maybe}>'

    expect(view.get 'test').to.equal '<input id=$0>'
    expect(view.get 'test', maybe: false).to.equal '<input id=$1>'
    expect(view.get 'test', maybe: true).to.equal '<input id=$2 disabled>'

  it 'supports paths containing dots for ctx object items', ->
    view.make 'test', '<b>{{user.name}}</b>'
    ctx = user: {name: 'John'}

    expect(view.get 'test', ctx).to.equal '<b>John</b>'

  it 'supports relative paths for ctx object items', ->
    view.make 'test', '{{#if user}}<b>{{.name}}</b>{{/}}'
    ctx = user: {name: 'John'}

    expect(view.get 'test', ctx).to.equal '<b>John</b>'

  it 'supports Arrays containing non-objects from ctx', ->
    view.make 'test1', '{{#each bools}}<b>{{this}}</b>{{/}}'
    view.make 'test2', '{{#each bools as :value}}<b>{{:value}}</b>{{/}}'
    ctx = bools: [true, false, true]

    expect(view.get 'test1', ctx).to.equal '<b>true</b><b>false</b><b>true</b>'
    expect(view.get 'test2', ctx).to.equal '<b>true</b><b>false</b><b>true</b>'

  it 'supports view helper functions', ->
    view.fn 'lower', (s) -> s.toLowerCase()

    view.make 'test', '''{{lower('HI')}} {lower( "HI" )}'''
    expect(view.get 'test').to.equal 'hi <!--$0-->hi<!--$$0-->'

    view.fn 'sum', (a, b) -> a + b

    view.make 'test', '{{sum(4, 9)}}'
    expect(view.get 'test').to.equal '13'

    view._idCount = 0
    view.make 'test', '{equal(1, sum(-5, 6))}'
    expect(view.get 'test').to.equal '<!--$0-->true<!--$$0-->'

    view._idCount = 0
    view.make 'test', '{unescaped equal(sum(-5, 6), 1)}'
    expect(view.get 'test').to.equal '<!--$0-->true<!--$$0-->'

    view.make 'test', '{{sum(4, count)}}'
    expect(view.get 'test', {count: 7}).to.equal '11'
    model.set 'count', 13
    expect(view.get 'test').to.equal '17'

    view._idCount = 0
    view.make 'test', '''
      <select>
        {{#each items}}
          <option selected="{{equal(this, current)}}">{{this}}
        {{/}}
      </select>
      '''
    expect(view.get 'test',
      items: ['a', 'b', 'c']
      current: 'c'
    ).to.equal '<select id=$0><option>a<option>b<option selected>c</select>'

    view.fn 'positive', (num) -> num >= 0

    view.make 'test', '''
      {{#each nums as :num}}
        {{#if positive(:num)}}
          {{:num}},
        {{/}}
      {{/}}
      '''
    expect(view.get 'test', {nums: [-4, 8, 0, 2.3, -9]}).to.equal '8,0,2.3,'

  it 'supports x-no-minify', ->
    view.make 'test', '''
      <script type="x-test" x-no-minify>
        Some text
        And a new line
      </script>
      '''

    expect(view.get 'test').to.equal '''
      <script type=x-test>
        Some text
        And a new line
      </script>
      '''