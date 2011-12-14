# TODO: Test two levels of nesting arrays
# TODO: Test moving arrays

# TODO: Can this code be refactored? Feels repetative


# Keeps track of each unique path via an ID
module.exports = PathMap = ->
  @clear()
  return

PathMap:: =
  clear: ->
    @count = 0
    @ids = {}
    @paths = {}
    @arrays = {}

  id: (path) ->
    # Return the path for an id, or create a new id and index it
    this.ids[path] || (
      this.paths[id = ++@count] = path
      @indexArray path, id
      this.ids[path] = id
    )

  indexArray: (name, id) ->
    while match = /^(.+)\.(\d+)(\..+|$)/.exec name
      name = match[1]
      index = +match[2]
      remainder = match[3]
      arr = @arrays[name] || @arrays[name] = []
      set = arr[index] || arr[index] = {}
      if nested
        setArrays = set.arrays || set.arrays = {}
        setArrays[remainder] = true
      else
        set[id] = remainder
      nested = true

  _incrementItems: (path, map, start, end, byNum) ->
    for i in [start..end]
      continue unless ids = map[i]
      for id, remainder of ids
        if id is 'arrays'
          for remainder of ids[id]
            arrayPath = path + '.' + i + remainder
            arrayPathTo = path + '.' + (i + byNum) + remainder
            arrayMap = @arrays[arrayPath]
            @arrays[arrayPathTo] = arrayMap
            delete @arrays[arrayPath]
            @_incrementItems arrayPathTo, arrayMap, 0, arrayMap.length, 0
          continue
        itemPath = path + '.' + (i + byNum) + remainder
        @paths[id] = itemPath
        @ids[itemPath] = +id

  _deleteItems: (path, map, start, end, last) ->
    for i in [start..last]
      continue unless ids = map[i]
      for id of ids
        if id is 'arrays'
          for remainder of ids[id]
            arrayPath = path + '.' + i + remainder
            arrayMap = @arrays[arrayPath]
            arrayLen = arrayMap.length
            @_deleteItems arrayPath, arrayMap, 0, arrayLen, arrayLen - 1
            continue if i >= end
            delete @arrays[arrayPath]
          continue
        itemPath = @paths[id]
        delete @ids[itemPath]
        continue if i >= end
        delete @paths[id]
  
  onRemove: (path, start, howMany) ->
    return unless map = @arrays[path]
    end = start + howMany
    last = map.length - 1
    # Delete indicies for removed items
    @_deleteItems path, map, start, end, last
    # Decrement indicies of later items
    unless end > last
      @_incrementItems path, map, end, last, -howMany
    map.splice start, howMany
  
  onInsert: (path, start, howMany) ->
    return unless map = @arrays[path]
    end = start + howMany
    last = map.length - 1
    # Delete indicies for items in inserted positions
    @_deleteItems path, map, start, end, last
    # Increment indicies of later items
    @_incrementItems path, map, start, last, howMany
    map.splice start, 0, {}  while howMany--
    return

  onMove: (path, from, to) ->
    return unless map = @arrays[path]
    # Adjust paths for the moved item
    @_incrementItems path, map, from, from, to - from
    # Adjust paths for items between from and to
    if from > to
      @_incrementItems path, map, to, from - 1, 1
    else
      @_incrementItems path, map, from + 1, to, -1
    # Fix the array index
    [item] = map.splice from, 1
    map.splice to, 0, item
    return
