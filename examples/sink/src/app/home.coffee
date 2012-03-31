{get, ready, view} = require './index'
{render} = require './shared'

# Define a view helper function for use in templates
view.fn 'unspace', (s) -> s && s.replace /\s/g, ''

get '/', (page, model) ->
  model.subscribe 'home', (err, home) ->
    home.setNull 'titleColor', 'black'
    home.setNull 'colors', [
      'black'
      'deep pink'
      'lime green'
      'coral'
      'dark turquoise'
      'dark orchid'
    ]
    render page, 'home'


ready (model) ->
  home = model.at 'home'
  colors = home.at 'colors'
  titleColor = home.at 'titleColor'
  titleSelect = document.getElementById 'titleSelect'

  # DOM bindings pass in the event object as the last argument
  # when they set a value in the model

  # Set the color of the currently selected option when updating
  # the titleColor to keep that option selected
  titleColor.on 'pre:set', (value, previous, isLocal, e) ->
    if e && e.target.id == 'titleInput'
      colors.set titleSelect.selectedIndex, value

  # Set the color of the title when updating an option if the
  # option is currently selected
  colors.on 'pre:set', '*', (index, value, previous, isLocal, e) ->
    if e && e.target.className == 'colorInput' && parseInt(index) == titleSelect.selectedIndex
      titleColor.set value
