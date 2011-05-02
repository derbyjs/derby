var _ = require('./utils');
if (_.onServer) {
  var mongo = require('mongodb'),
      collections = {},
      versCollection, db, model;
  
  function dbInfo(callback) {
    versCollection.findOne({ name: 'dbInfo' }, function(err, info) {
      if (!info) {
        info = {
          name: 'dbInfo',
          collections: {}
        };
        versCollection.insert(info);
      }
      callback(info);
    });
  }
  
  module.exports = function(dbUrl, m, parentExports) {
    function loadModel(names, types) {
      var name = names.pop();
      if (name) {
        collections[name].find(function(err, cursor) {
          var type = types[name];
          cursor.toArray(function(err, a) {
            var i, index, item, m;
            if (type === 'array') {
              model.setSilent(name, a);
              m = model.get(name);
              for (i = 0; item = m[i++];) {
                delete item._id;
              }
            } else if (type === 'object') {
              for (i = 0; item = a[i++];) {
                if (index = item.__i) {
                  delete item._id;
                  model.setSilent(name + '.' + index, item);
                }
              }
            }
            loadModel(names, types);
          });
        });
      } else {
        if (_.isFunction(parentExports.load)) parentExports.load();
      }
    }
  
    function getCollections(names, types) {
      var name = names.pop();
      if (name) {
        db.collection(name, function(err, obj) {
          collections[name] = obj;
          getCollections(names, types);
        });
      } else {
        loadModel(Object.keys(collections), types);
      }
    }
  
    model = m;
  
    mongo.connect(dbUrl, function(err, obj) {
      db = obj;
      db.collection('vers', function(err, obj) {
        versCollection = obj;
        dbInfo(function(info) {
          var types = info.collections;
          getCollections(Object.keys(types), types);
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
          dbInfo(function(info) {
            info.collections[name] = type;
            versCollection.update({ name: 'dbInfo' }, info);
          });
          
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