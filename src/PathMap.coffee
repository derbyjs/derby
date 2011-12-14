# TODO: Test two levels of nesting arrays
# TODO: Test moving arrays

# Keeps track of each unique path via an id
module.exports = PathMap = ->
  @clear()
  return

PathMap:: =
  clear: ->
    @count = 0
    @ids = {}
    @paths = {}
    @arrays = {}
    return

  id: (path) ->
    # Return the path for an id, or create a new id and index it
    this.ids[path] || (
      this.paths[id = ++@count] = path
      @_indexArray path, id
      this.ids[path] = id
    )

  _indexArray: (path, id) ->
    while match = /^(.+)\.(\d+)(\..+|$)/.exec path
      path = match[1]
      index = +match[2]
      remainder = match[3]
      arr = @arrays[path] || @arrays[path] = []
      set = arr[index] || arr[index] = {}
      if nested
        setArrays = set.arrays || set.arrays = {}
        setArrays[remainder] = true
      else
        set[id] = remainder
      nested = true
    return

  _incrItems: (path, map, start, end, byNum, oldArrays = {}, oldPath) ->
    for i in [start...end]
      continue unless ids = map[i]
      for id, remainder of ids
        if id is 'arrays'
          for remainder of ids[id]
            arrayPath = (oldPath || path) + '.' + i + remainder
            if arrayMap = @arrays[arrayPath] || oldArrays[arrayPath]
              arrayPathTo = path + '.' + (i + byNum) + remainder
              @arrays[arrayPathTo] = arrayMap
              @_incrItems arrayPathTo, arrayMap, 0, arrayMap.length, 0, oldArrays, arrayPath
          continue
        itemPath = path + '.' + (i + byNum) + remainder
        @paths[id] = itemPath
        @ids[itemPath] = +id
    return

  _delItems: (path, map, start, end, oldArrays = {}) ->
    for i in [start...map.length]
      continue unless ids = map[i]
      for id of ids
        if id is 'arrays'
          for remainder of ids[id]
            arrayPath = path + '.' + i + remainder
            if arrayMap = @arrays[arrayPath]
              @_delItems arrayPath, arrayMap, 0, arrayMap.length, oldArrays
              oldArrays[arrayPath] = arrayMap
              delete @arrays[arrayPath]
          continue
        itemPath = @paths[id]
        delete @ids[itemPath]
        continue if i > end
        delete @paths[id]
    return oldArrays
  
  onRemove: (path, start, howMany) ->
    return unless map = @arrays[path]
    end = start + howMany
    # Delete indicies for removed items
    oldArrays = @_delItems path, map, start, end + 1
    # Decrement indicies of later items
    @_incrItems path, map, end, map.length, -howMany, oldArrays
    map.splice start, howMany
    return
  
  onInsert: (path, start, howMany) ->
    return unless map = @arrays[path]
    end = start + howMany
    # Delete indicies for items in inserted positions
    oldArrays = @_delItems path, map, start, end + 1
    # Increment indicies of later items
    @_incrItems path, map, start, map.length, howMany, oldArrays
    map.splice start, 0, {}  while howMany--
    return

  onMove: (path, from, to) ->
    return unless map = @arrays[path]
    # Adjust paths for the moved item
    @_incrItems path, map, from, from + 1, to - from
    # Adjust paths for items between from and to
    if from > to
      @_incrItems path, map, to, from, 1
    else
      @_incrItems path, map, from + 1, to + 1, -1
    # Fix the array index
    [item] = map.splice from, 1
    map.splice to, 0, item
    return
