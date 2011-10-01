{get, view, ready} = require('derby').createApp module

pages = [
  {name: 'home', text: 'Home', url: '/'}
  {name: 'liveCss', text: 'Live CSS', url: '/live-css'}
]
ctxFor = (name) ->
  ctx = {}
  ctx[name] = true
  last = pages.length - 1
  ctx.pages = for page, i in pages
    page = Object.create page
    page.current = true  if page.name == name
    page.last = true  if i == last
    page
  return ctx

get '/', (page) ->
  page.render ctxFor 'home'

get '/live-css', (page, model) ->
  model.subscribe 'x.**', ->
    model.setNull 'x.styles', [
      {prop: 'color', value: '#c00', active: true}
      {prop: 'font-weight', value: 'bold', active: true}
      {prop: 'font-size', value: '18px', active: false}
    ]
    model.setNull 'x.outputText', 'Edit this text...'
    page.render ctxFor 'liveCss'

view.make 'Head', '''
  <style>
    p{margin:0;padding:0}
    body{margin:10px}
    body,select{font:13px/normal arial,sans-serif}
    ins{text-decoration:none}
    .css{margin-left:10px}
  </style>
  '''

view.make 'Body', '''
  <p>
  {{#pages}}
    {{#current}}
      <b>{{text}}</b>{{^last}} | {{/}}
    {{^}}
      <a href={{url}}>{{text}}</a>{{^last}} | {{/}}
    {{/}}
  {{/}}
  <hr>
  {{#home}}{{> home}}{{/}}
  {{#liveCss}}{{> liveCss}}{{/}}
  '''

view.make 'home', '''
  <h1>Welcome!</h1>
  This is a collection of random demos. Check 'em out!
  '''

# Option tags & contenteditable must only contain a variable with no additional text
# For validation, non-closed p elements must be wrapped in a div instead of the
# default ins. Closed p's are fine in an ins element.
view.make 'liveCss', '''
  <select multiple><optgroup label="CSS properties">
    ((#x.styles))<option selected=((.active))>((.prop))((/))
  </select>
  <div>
    ((#x.styles))
      <p><input type=checkbox checked=((.active))> 
      <input value=((.prop)) disabled=!((.active))> 
      <input value=((.value)) disabled=!((.active))>
    ((/))
  </div>
  <button x-bind=click:addStyle>Add</button>
  <h3>Currently applied:</h3>
  <p>{
    <p class=css>((#x.styles :style))((> cssProperty))((#:style.active))<br>((/))((/))
  <p>}
  <h3>Output:</h3>
  <p style="((x.styles :style > cssProperty))" contenteditable>(((x.outputText)))</p>
  '''

view.make 'cssProperty', '''((#:style.active))((:style.prop)): ((:style.value));((/))'''

ready (model) ->
  exports.addStyle = ->
    model.push 'x.styles', {}
