derby = require 'derby'
{ready, model, view} = derby.createApp module, exports

view.make 'Body', """
  <input type=checkbox checked={{x.value}}>
  <input type=checkbox checked={{x.value}}>
  """

