var _ = require('./utils');
if (_.onServer) {
  var mongo = require('mongodb'),
      collections = {},
      model, db, versCollection, dbInfo;

  function updateDbInfo() {
    versCollection.update({ name: 'dbInfo' }, dbInfo, { upsert: true });
  }

  module.exports = function(dbUrl, m, parentExports) {
    var collectionTypes = {};
    
    function loadModel(items) {
      var name = items.pop();
      if (name) {
        collections[name].find(function(err, cursor) {
          var type = collectionTypes[name];
          cursor.toArray(function(err, a) {
            var i, index, item;
            if (type === 'array') {
              model.set(name, a);
            } else if (type === 'object') {
              for (i = 0; item = a[i++];) {
                if (index = item.__i) {
                  model.set(name + '.' + index, item);
                }
              }
            }
            loadModel(items);
          });
        });
      } else {
        if (_.isFunction(parentExports.load)) parentExports.load();
      }
    }
  
    function getCollections(items) {
      var item = items.pop();
      if (item) {
        var name = item.name;
        db.collection(name, function(err, obj) {
          collections[name] = obj;
          collectionTypes[name] = item.type;
          getCollections(items);
        });
      } else {
        loadModel(Object.keys(collections));
      }
    }
  
    model = m;
  
    mongo.connect(dbUrl, function(err, obj) {
      db = obj;
      db.collection('vers', function(err, obj) {
        versCollection = obj;
        versCollection.findOne({ name: 'dbInfo' }, function(err, obj) {
          dbInfo = obj;
          if (!dbInfo) {
            dbInfo = {
              name: 'dbInfo',
              collections: []
            };
            updateDbInfo();
          }
          getCollections(dbInfo.collections);
        });
      });
    });
  
    return exports;
  };

  exports.message = function(method, args) {
    var name = args[0],
        path = name.split('.'),
        value = args[1];
  
    function getCollection(name, type, callback) {
      var collection = collections[name];
      if (collection) {
        callback(collection);
      } else {
        db.collection(name, function(err, collection) {
          collections[name] = collection;
          dbInfo.collections.push({ name: name, type: type });
          updateDbInfo();
          callback(collection);
        });
      }
    }
  
    function set(path, value) {
      var i, val, parentName, type;
      
      // TODO: make sure that objects and arrays don't contain any nested
      // objects or arrays. If they do, create subcollections.
      if (_.isArray(value)) {
        collections[name]
        getCollection(name, 'array', function(collection) {
          collection.remove(function() {
            collection.insert(value);
          });
        });
      } else if (typeof value === 'object' && value !== {}) {
        i = path.pop();
        parentName = path.join('.');
        getCollection(parentName, 'object', function(collection) {
          value.__i = i;
          collection.update({ __i: i }, value, { upsert: true });
        });
      } else {
        // TODO: Make this able to set values at the top level. Currently it
        // only works on a path that is two levels deep.
        val = path.pop();
        i = path.pop();
        parentName = path.join('.');
        type = _.isArray(model.get(parentName)) ? 'array' : 'object';
        getCollection(parentName, type, function(collection) {
          var obj = {};
          obj[val] = value;
          collection.update({ __i: i }, { $set: obj }, { upsert: true });
        });
      }
    }
  
    if (method === 'set') {
      set(path, value);
    } else if (method === 'push') {
      getCollection(name, 'array', function(collection) {
        collection.insert(value);
      });
    }
  };
} else { }