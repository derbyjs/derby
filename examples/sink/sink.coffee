{get, view, ready} = require('derby').createApp module, exports

get '/', (render, model) ->
  model.subscribe 'x.**', ->
    model.setNull 'x.styles', [
      {prop: 'color', value: '#c00', active: true}
      {prop: 'font-weight', value: 'bold', active: true}
      {prop: 'font-size', value: '18px', active: false}
    ]
    model.setNull 'x.outputText', 'Edit this text...'
    render()

view.make 'Head', '''
  <style>
    p{margin:0;padding:0}
    body{margin:10px}
    body,select{font:13px/normal arial,sans-serif}
    ins{text-decoration:none}
    .css{margin-left:10px}
  </style>
  '''

# Option tags & contenteditable must only contain a variable with no additional text
# For validation, non-closed p elements must be wrapped in a div instead of the
# default ins. Closed p's are fine in an ins element.
view.make 'Body', '''
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
