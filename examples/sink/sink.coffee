derby = require 'derby'
{ready, model, view} = derby.createApp module, exports

view.make 'Head', """
  <style>
    p{margin:0;padding:0}
    body{margin:10px}
    body,select{font:13px/normal arial,sans-serif}
    ins{text-decoration:none}
  </style>
  """

view.make 'optionText', '{{.}}!'
  
# For validation, non-closed p elements must be wrapped in a div instead of the
# default ins. Closed p's are fine in an ins element.
# Option tags must only contain a variable with no additional text
view.make 'Body', """
  <select multiple><optgroup label=Animals>{{#x.options}}
    <option selected={{.active}}>{{.text}}
  {{/}}</select>
  <div>{{#x.options}}
    <p><input type=checkbox checked={{.active}}> <input value={{.text}} disabled=!{{.active}}>
  {{/}}</div>
  {{x.options.0.text > optionText}}
  """

