derby = require 'derby'
{ready, model, view} = derby.createApp module, exports

view.make 'Head', '''
  <style>
    p{margin:0;padding:0}
    body{margin:10px}
    body,select{font:13px/normal arial,sans-serif}
    ins{text-decoration:none}
    .css{margin-left:10px}
  </style>
  '''

view.make 'cssProperty', '((#.active))((..prop)): ((..value));((/))'

# Option tags must only contain a variable with no additional text
# For validation, non-closed p elements must be wrapped in a div instead of the
# default ins. Closed p's are fine in an ins element.
view.make 'Body', '''
  <select multiple><optgroup label="CSS properties">((#x.styles))
    <option selected=((.active))>((.prop))
  ((/))</select>
  <div>((#x.styles))
    <p><input type=checkbox checked=((.active))> 
    <input value=((.prop)) disabled=!((.active))> 
    <input value=((.value)) disabled=!((.active))>
  ((/))</div>
  <h3>Currently applied:</h3>
  <p>{
    <p class=css>((#x.styles))((> cssProperty))((#.active))<br>((/))((/))
  <p>}
  <h3>Output:</h3>
  <p style="((x.styles > cssProperty))" contenteditable>Edit this text...
  '''

