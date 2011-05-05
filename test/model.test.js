var wrapTest = require('./helpers').wrapTest,
    assert = require('assert');

function makeModel(environment) {
  var model = require('../lib/model.js');
  model._.onServer = environment === 'server';
  return model;
}

module.exports = {
  'test model set and get simple objects': function() {
    var model = makeModel('server'),
        page = {
          name: 'test',
          lines: ['line1', 'line 2', 'more lines...'],
          length: 3
        };
    model.set('files.doc.page', page);
    model.get('files.doc.page').should.eql(page);
    model.get().should.eql({ files: { doc: { page: page } } });
    model.get('files.doc.page.name').should.eql(page.name);
    model.get('files.doc.page.lines').should.eql(page.lines);
    model.get('files.doc.page.lines.1').should.eql('line 2');
    model.set('files.info', { more: 'stuff' });
    model.set('files.doc.page.name', 34);
    page.name = 34;
    model.get().should.eql({
      files: {
        doc: { page: page },
        info: { more: 'stuff' }
      }
    });
  },
  'test model init data': function() {
    var model = makeModel('server'),
        obj = {
          files: {
            doc: {
              num: 3,
              arr: [2, 3, 4]
            }
          }
        };
    model.init(obj);
    model.get().should.eql(obj);
    model.get('files.doc.num').should.eql(3);
  },
  'test model set and get references': function() {
    var model = makeModel('server');
    model.init({
      info: {
        users: [
          // References can be direct links to another object in the model
          { name: 'user1', color: model.ref('info.favoriteColors') },
          { name: 'ben', color: 'purple' }
        ],
        favoriteColors: ['aqua', 'orange']
      },
      userIndex: 1,
      // They can also take a second argument for another model object that
      // acts as a key on the referenced object
      user: model.ref('info.users', 'userIndex')
    });
    // References can be used with getters and setters
    model.get('user.name').should.equal('ben');
    model.set('user.color', 'green');
    model.get('info.users.1.color').should.equal('green');
    // Update the reference key
    model.set('userIndex', 0);
    model.get('user.color.0').should.equal('aqua');
    // It is possible to modify properties on the referenced object, but if the
    // item that is currently set to a reference is set to something else, the
    // reference is replaced instead of updating the referenced object.
    model.set('user.color.1', 'pink');
    model.set('user.color', 'red');
    model.get('user.color').should.equal('red');
    model.get('info.favoriteColors').should.eql(['aqua', 'pink']);
  }
}