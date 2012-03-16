{get, ready} = app = require './index'
{render} = require './shared'

get '/sorted-list', (page, model) ->
  model.subscribe 'sortedList', (err, sortedList) ->
    sortedList.setNull
      items: [
        {text: 'Billy Budd', score: 10}
        {text: 'Jim Jones', score: 5}
        {text: 'Sally Summers', score: 20}
      ]

    # Sort items in descending order by score
    model.fn '_sorted', 'sortedList.items', (items) ->
      # Reactive functions must not affect their inputs, so be sure
      # to slice any arrays before calling sort or other methods
      # that modify the original array
      items.slice().sort (a, b) -> b.score - a.score

    render page, 'sortedList'


ready (model) ->

  app.sortedList = ->
    addItem: ->

