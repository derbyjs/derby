{get, view, ready} = sink = require('derby').createApp module


## Routing ##

pages = [
  {name: 'home', text: 'Home', url: '/'}
  {name: 'liveCss', text: 'Live CSS', url: '/live-css'}
  {name: 'submit', text: 'Submit form', url: '/submit'}
  {name: 'error', text: 'Error test', url: '/error'}
]
ctxFor = (name) ->
  ctx = {}
  ctx[name + 'Visible'] = true
  last = pages.length - 1
  ctx.pages = for page, i in pages
    page = Object.create page
    if page.name is name
      page.current = true
      ctx.title = page.text
    page.last = i is last
    page
  return ctx

get '/', (page) ->
  page.render ctxFor 'home'

get '/live-css', (page, model) ->
  model.subscribe 'liveCss.**', ->
    console.log model.get('liveCss.styles')?
    model.setNull 'liveCss.styles', [
      {prop: 'color', value: '#c00', active: true}
      {prop: 'font-weight', value: 'bold', active: true}
      {prop: 'font-size', value: '18px', active: false}
    ]
    model.setNull 'liveCss.outputText', 'Edit this text...'
    console.log model.get('liveCss.outputText'), model.get('liveCss.styles')
    page.render ctxFor 'liveCss'

['get', 'post', 'put', 'del'].forEach (method) ->
  sink[method] '/submit', (page, model, {body, query}) ->
    console.log method, body, query
    page.render ctxFor 'submit'

get '/error', () ->
  throw new Error 500

## Views ##

view.make 'Title', '''Derby demo: {{title}}'''

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
  {{#homeVisible}}{{> home}}{{/}}
  {{#liveCssVisible}}{{> liveCss}}{{/}}
  {{#submitVisible}}{{> submit}}{{/}}
  '''

view.make 'home', '''
  <h1>Welcome!</h1>
  <p>This is a collection of random demos. Check 'em out! <a href=#jump>Test jump link</a>
  <p style=margin-top:1000px>
  <a name=jump>Jumped!</a>
  '''

# Option tags & contenteditable must only contain a variable with no additional text
# For validation, non-closed p elements must be wrapped in a div instead of the
# default ins. Closed p's are fine in an ins element.
view.make 'liveCss', '''
  <select multiple><optgroup label="CSS properties">
    ((#liveCss.styles))<option selected=((.active))>((.prop))((/))
  </select>
  <div>
    ((#liveCss.styles))
      <p><input type=checkbox checked=((.active))> 
      <input value=((.prop)) disabled=!((.active))> 
      <input value=((.value)) disabled=!((.active))>
    ((/))
  </div>
  <button x-bind=click:addStyle>Add</button>
  <h3>Currently applied:</h3>
  <p>{
    <p class=css>((#liveCss.styles :style))((> cssProperty))((#:style.active))<br>((/))((/))
  <p>}
  <h3>Output:</h3>
  <p style="((liveCss.styles :style > cssProperty))" contenteditable>
    (((liveCss.outputText)))
  </p>
  '''

view.make 'cssProperty', '''((#:style.active))((:style.prop)): ((:style.value));((/))'''

view.make 'submit', '''
  <form action=submit method=post>
    <input type=hidden name=_method value=put>
    <p><label>Name: <input type=text name=user[name]></label>
    <p><label>Email: <input type=text name=user[email]></label>
    <p><input type=submit>
  </form>
  '''


## Controller functions ##

ready (model) ->
  exports.addStyle = ->
    model.push 'liveCss.styles', {}
