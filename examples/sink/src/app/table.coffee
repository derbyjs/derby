{get, ready} = app = require './index'
{render} = require './shared'
sortableTable = require './sortableTable'

get '/table', (page, model) ->
  model.subscribe 'table', (err, table) ->
    table.setNull
      rows: [
        {name: 1, cells: [{}, {}, {}]}
        {name: 2, cells: [{}, {}, {}]}
      ]
      lastRow: 1
      cols: [
        {name: 'A'}
        {name: 'B'}
        {name: 'C'}
      ]
      lastCol: 2
    render page, 'tableEditor'


ready (model) ->

  rows = model.at 'table.rows'
  cols = model.at 'table.cols'

  app.tableEditor =
    deleteRow: (e, el) ->
      model.at(el).remove()

    deleteCol: (e, el) ->
      # TODO: Make these move operations atomic when Racer has atomic support
      i = model.at(el).leaf()
      row = rows.get 'length'
      while row--
        rows.remove "#{row}.cells", i
      cols.remove i

    addRow: ->
      name = model.incr('table.lastRow') + 1
      cells = []
      col = cols.get 'length'
      while col--
        cells.push {}
      rows.push {name, cells}

    addCol: ->
      row = rows.get 'length'
      while row--
        rows.push "#{row}.cells", {}
      name = alpha model.incr 'table.lastCol'
      cols.push {name}

  alpha = (num, out = '') ->
    mod = num % 26
    out = String.fromCharCode(65 + mod) + out
    if num = Math.floor num / 26
      return alpha num - 1, out
    else
      return out

  sortableTable.init app, app.tableEditor,
    onRowMove: (from, to) ->
      rows.move from, to
    onColMove: (from, to) ->
      # TODO: Make these move operations atomic when Racer has atomic support
      cols.move from, to
      row = rows.get 'length'
      while row--
        rows.move "#{row}.cells", from, to
