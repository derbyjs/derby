{get, ready, view} = app = require './index'
{render} = require './shared'

# Define a view helper functions for use in templates
view.fn 'unspace', (s) ->
  s && s.replace /\s/g, ''

view.fn 'capitalize', (s) ->
  s && s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

get '/', (page, model) ->
  model.subscribe 'home', (err, home) ->
    home.setNull 'titleColor', 'black'
    home.setNull 'colors', [
      {name: 'black'}
      {name: 'deep pink'}
      {name: 'lime green'}
      {name: 'coral'}
      {name: 'dark turquoise'}
      {name: 'dark orchid'}
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
      colors.at(titleSelect.selectedIndex).set 'name', value

  # Set the color of the title when updating an option if the
  # option is currently selected
  colors.on 'pre:set', '*.name', (index, value, previous, isLocal, e) ->
    if e && e.target.className == 'colorInput' && parseInt(index) == titleSelect.selectedIndex
      titleColor.set value

  app.home =
    select: (e, el) ->
      titleSelect.selectedIndex = model.at(el).leaf()
      # Manually trigger a change event on the select element, since
      # updating the selectedIndex does not emit an event
      view.dom.trigger {type: 'change'}, titleSelect
