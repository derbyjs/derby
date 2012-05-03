module.exports = PathMap

function PathMap() {
  this.clear();
}
PathMap.prototype = {
  clear: function() {
    this.count = 0;
    this.ids = {};
    this.paths = {};
    this.arrays = {};
  }

, id: function(path) {
    var id;
    // Return the path for an id, or create a new id and index it
    return this.ids[path] || (
      id = ++this.count
    , this.paths[id] = path
    , this._indexArray(path, id)
    , this.ids[path] = id
    );
  }

, _indexArray: function(path, id) {
    var arr, index, match, nested, remainder, set, setArrays;
    while (match = /^(.+)\.(\d+)(\*?(?:\..+|$))/.exec(path)) {
      path = match[1];
      index = +match[2];
      remainder = match[3];
      arr = this.arrays[path] || (this.arrays[path] = []);
      set = arr[index] || (arr[index] = {});
      if (nested) {
        setArrays = set.arrays || (set.arrays = {});
        setArrays[remainder] = true;
      } else {
        set[id] = remainder;
      }
      nested = true;
    }
  }

, _incrItems: function(path, map, start, end, byNum, oldArrays, oldPath) {
    var arrayMap, arrayPath, arrayPathTo, i, id, ids, itemPath, remainder;
    if (oldArrays == null) oldArrays = {};

    for (i = start; i < end; i++) {
      ids = map[i];
      if (!ids) continue;

      for (id in ids) {
        remainder = ids[id];
        if (id === 'arrays') {
          for (remainder in ids[id]) {
            arrayPath = (oldPath || path) + '.' + i + remainder;
            arrayMap = oldArrays[arrayPath] || this.arrays[arrayPath];
            if (arrayMap) {
              arrayPathTo = path + '.' + (i + byNum) + remainder;
              this.arrays[arrayPathTo] = arrayMap;
              this._incrItems(arrayPathTo, arrayMap, 0, arrayMap.length, 0, oldArrays, arrayPath);
            }
          }
          continue;
        }

        itemPath = path + '.' + (i + byNum) + remainder;
        this.paths[id] = itemPath;
        this.ids[itemPath] = +id;
      }
    }
  }

, _delItems: function(path, map, start, end, len, oldArrays) {
    var arrayLen, arrayMap, arrayPath, i, id, ids, itemPath, remainder;
    if (oldArrays == null) oldArrays = {};

    for (i = start; i < len; i++) {
      ids = map[i];
      if (!ids) continue;

      for (id in ids) {
        if (id === 'arrays') {
          for (remainder in ids[id]) {
            arrayPath = path + '.' + i + remainder;
            if (arrayMap = this.arrays[arrayPath]) {
              arrayLen = arrayMap.length;
              this._delItems(arrayPath, arrayMap, 0, arrayLen, arrayLen, oldArrays);
              oldArrays[arrayPath] = arrayMap;
              delete this.arrays[arrayPath];
            }
          }
          continue;
        }

        itemPath = this.paths[id];
        delete this.ids[itemPath];
        if (i > end) continue;
        delete this.paths[id];
      }
    }

    return oldArrays;
  }

, onRemove: function(path, start, howMany) {
    var map = this.arrays[path]
      , end, len, oldArrays;
    if (!map) return;
    end = start + howMany;
    len = map.length;
    // Delete indicies for removed items
    oldArrays = this._delItems(path, map, start, end + 1, len);
    // Decrement indicies of later items
    this._incrItems(path, map, end, len, -howMany, oldArrays);
    map.splice(start, howMany);
  }

, onInsert: function(path, start, howMany) {
    var map = this.arrays[path]
      , end, len, oldArrays;
    if (!map) return;
    end = start + howMany;
    len = map.length;
    // Delete indicies for items in inserted positions
    oldArrays = this._delItems(path, map, start, end + 1, len);
    // Increment indicies of later items
    this._incrItems(path, map, start, len, howMany, oldArrays);
    while (howMany--) {
      map.splice(start, 0, {});
    }
  }

, onMove: function(path, from, to, howMany) {
    var map = this.arrays[path]
      , afterFrom, afterTo, items, oldArrays;
    if (!map) return;
    afterFrom = from + howMany;
    afterTo = to + howMany;
    // Adjust paths for items between from and to
    if (from > to) {
      oldArrays = this._delItems(path, map, to, afterFrom, afterFrom);
      this._incrItems(path, map, to, from, howMany, oldArrays);
    } else {
      oldArrays = this._delItems(path, map, from, afterTo, afterTo);
      this._incrItems(path, map, afterFrom, afterTo, -howMany, oldArrays);
    }
    // Adjust paths for the moved item(s)
    this._incrItems(path, map, from, afterFrom, to - from, oldArrays);
    // Fix the array index
    items = map.splice(from, howMany);
    map.splice.apply(map, [to, 0].concat(items));
  }
}
