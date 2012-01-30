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
            if arrayMap = oldArrays[arrayPath] || @arrays[arrayPath]
              arrayPathTo = path + '.' + (i + byNum) + remainder
              @arrays[arrayPathTo] = arrayMap
              @_incrItems arrayPathTo, arrayMap, 0, arrayMap.length, 0, oldArrays, arrayPath
          continue
        itemPath = path + '.' + (i + byNum) + remainder
        @paths[id] = itemPath
        @ids[itemPath] = +id
    return

  _delItems: (path, map, start, end, len, oldArrays = {}) ->
    for i in [start...len]
      continue unless ids = map[i]
      for id of ids
        if id is 'arrays'
          for remainder of ids[id]
            arrayPath = path + '.' + i + remainder
            if arrayMap = @arrays[arrayPath]
              arrayLen = arrayMap.length
              @_delItems arrayPath, arrayMap, 0, arrayLen, arrayLen, oldArrays
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
    len = map.length
    # Delete indicies for removed items
    oldArrays = @_delItems path, map, start, end + 1, len
    # Decrement indicies of later items
    @_incrItems path, map, end, len, -howMany, oldArrays
    map.splice start, howMany
    return
  
  onInsert: (path, start, howMany) ->
    return unless map = @arrays[path]
    end = start + howMany
    len = map.length
    # Delete indicies for items in inserted positions
    oldArrays = @_delItems path, map, start, end + 1, len
    # Increment indicies of later items
    @_incrItems path, map, start, len, howMany, oldArrays
    map.splice start, 0, {}  while howMany--
    return

  onMove: (path, from, to, howMany) ->
    return unless map = @arrays[path]
    afterFrom = from + howMany
    afterTo = to + howMany
    # Adjust paths for items between from and to
    if from > to
      oldArrays = @_delItems path, map, to, afterFrom, afterFrom
      @_incrItems path, map, to, from, howMany, oldArrays
    else
      oldArrays = @_delItems path, map, from, afterTo, afterTo
      @_incrItems path, map, afterFrom, afterTo, -howMany, oldArrays
    # Adjust paths for the moved item(s)
    @_incrItems path, map, from, afterFrom, to - from, oldArrays
    # Fix the array index
    items = map.splice from, howMany
    map.splice to, 0, items...
    return
