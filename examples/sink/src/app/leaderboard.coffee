{get, ready, view} = app = require './index'
{render} = require './shared'

randomScore = -> Math.floor(Math.random() * 20) * 5

get '/leaderboard', (page, model) ->
  model.subscribe 'leaderboard', (err, leaderboard) ->
    players = leaderboard.at 'players'
    sortedIds = leaderboard.at '_sortedIds'
    list = leaderboard.at '_list'
    list.refList players, sortedIds

    # Create list of ids in sorted in descending order by score
    model.fn sortedIds, players, (items) ->
      out = []
      for id of items
        out.push id if items[id].id
      return out.sort (a, b) ->
        items[b].score - items[a].score

    unless players.get()
      for name in ['Parker Blue', 'Kelly Green', 'Winston Fairbanks']
        list.push {name, score: randomScore()}

    render page, 'leaderboard'


ready (model) ->
  leaderboard = model.at 'leaderboard'
  players = leaderboard.at 'players'
  list = leaderboard.at '_list'
  newPlayer = leaderboard.at '_newPlayer'
  selectedId = leaderboard.at '_selectedId'
  selected = leaderboard.at '_selected'
  selected.ref players, selectedId

  selectedId.on 'set', (value, previous) ->
    players.at(previous).del '_class' if previous
    players.at(value).set '_class', 'selected' if value

  app.leaderboard =
    add: ->
      return unless name = newPlayer.get()
      list.push {name, score: randomScore()}
      newPlayer.set ''

    incr: ->
      players.at(selected.get().id).incr 'score', 5

    decr: -> selected.incr 'score', -5

    select: (e, el) ->
      id = model.at(el).get 'id'
      selectedId.set id

    deselect: (e) ->
      unless document.getElementById('leaderboard').contains e.target
        selectedId.set null
