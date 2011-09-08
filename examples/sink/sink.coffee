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

view.make 'Body', """
  <select multiple><optgroup label=Animals>{{#x.options}}
    <option selected={{.active}} x-bind=change:change>{{.text}}
  {{/}}</optgroup></select>
  {{#x.options}}
    <p><input type=checkbox checked={{.active}}> <input value={{.text}} disabled={{.active}}>
  {{/}}
  """

