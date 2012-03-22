{get, ready, view} = app = require './index'
{render} = require './shared'

randomScore = -> Math.floor(Math.random() * 20) * 5

addPlayer = (players, name) ->
  id = players.id()
  players.set id, {id, name, score: randomScore()}

get '/leaderboard', (page, model) ->
  model.subscribe 'leaderboard', (err, leaderboard) ->
    players = leaderboard.at 'players'
    unless players.get()
      for name in ['Parker Blue', 'Kelly Green', 'Winston Fairbanks']
        addPlayer players, name

    # Create list of players sorted in descending order by score
    list = leaderboard.at '_list'
    list.fn players, (items) ->
      out = []
      for id, item of items
        out.push item if item?.id
      return out.sort (a, b) ->
        (b.score - a.score) || (b.id > a.id)

    render page, 'leaderboard'


ready (model) ->
  leaderboard = model.at 'leaderboard'
  players = leaderboard.at 'players'
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
      addPlayer players, name
      newPlayer.set ''
    remove: ->
      id = selected.get 'id'
      players.del id

    incr: -> selected.incr 'score', 5
    decr: -> selected.incr 'score', -5

    select: (e, el) ->
      id = model.at(el).get 'id'
      selectedId.set id
    deselect: ->
      selectedId.set null
